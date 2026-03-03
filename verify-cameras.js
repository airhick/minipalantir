const SUPABASE_URL = 'https://thfbkakbbszvgbkicssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZmJrYWtiYnN6dmdia2ljc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MzUxOTEsImV4cCI6MjA4MjAxMTE5MX0.nMzv5oOThART2Q5e40RGtIeq0F3vz2X2M7mUtWXUQEo';

const SUPA_HEADERS = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json'
};

// Only content-types that browsers can natively display as image/video
// We are STRICT here: HTML is rejected unconditionally.
const STRICT_MEDIA_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'multipart/x-mixed-replace',   // MJPEG push streams
    'video/mp4',
    'video/webm',
    'video/ogg',
    'application/x-mpegurl',       // HLS .m3u8
    'application/vnd.apple.mpegurl', // HLS (Apple variant)
    'video/x-flv',
    // Note: octet-stream removed — too broad, accept only specific typed content
];

// URL-pattern based checks (trusted regardless of content-type)
const TRUSTED_URL_PATTERNS = [
    /\.m3u8(\?|$)/i,       // HLS playlist
    /\.mjpg(\?|$)/i,       // MJPEG
    /\.mjpeg(\?|$)/i,
    /\/mjpg\/video\.cgi/i, // Axis cameras
    /\/video\.cgi/i,
    /\/live\/.*\.m3u8/i,
    /\/stream(\?|$|\.|\/)/i,
    /\/videostream\.cgi/i,
];

// Patterns to reject regardless
const REJECT_PATTERNS = [
    'youtube.com', 'youtu.be', 'google.com', 'facebook.com', 'twitter.com',
    'instagram.com', 'linkedin.com', 'tiktok.com', 'vimeo.com',
    'openstreetmap.org', 'wikipedia.org', 'wikimedia.org',
];

async function checkUrl(urlStr) {
    if (!urlStr || !urlStr.startsWith('http')) return false;

    const lower = urlStr.toLowerCase();
    if (REJECT_PATTERNS.some(p => lower.includes(p))) return false;

    // Trust URL patterns that reliably indicate live video
    const isTrustedPattern = TRUSTED_URL_PATTERNS.some(re => re.test(urlStr));

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000); // 7s timeout

        const resp = await fetch(urlStr, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CCTVChecker/2.0)',
                'Accept': 'image/*, video/*, application/x-mpegurl, */*;q=0.1',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
            // Silently cancel body to avoid memory leak
            resp.body?.cancel().catch(() => { });
            return false;
        }

        const contentType = (resp.headers.get('content-type') || '').toLowerCase();

        // Hard reject HTML — a page saying "login required" is not a stream
        if (contentType.includes('text/html') || contentType.includes('text/plain')) {
            resp.body?.cancel().catch(() => { });
            return false;
        }

        const isValidType = STRICT_MEDIA_TYPES.some(t => contentType.includes(t));

        // Read first 32 bytes to spot JPEG magic number (FF D8 FF) as fallback
        // for cameras that send wrong content-type headers
        let isMagicValid = false;
        if (!isValidType && isTrustedPattern) {
            try {
                const reader = resp.body?.getReader();
                if (reader) {
                    const { value } = await reader.read();
                    reader.cancel().catch(() => { });
                    if (value && value.length >= 3) {
                        const isJpeg = value[0] === 0xFF && value[1] === 0xD8 && value[2] === 0xFF;
                        const isMp4 = value.length >= 8 && value[4] === 0x66 && value[5] === 0x74 && value[6] === 0x79 && value[7] === 0x70; // ftyp box
                        isMagicValid = isJpeg || isMp4;
                    }
                }
            } catch (_) {
                isMagicValid = false;
            }
        } else {
            resp.body?.cancel().catch(() => { });
        }

        return isValidType || isMagicValid;

    } catch (_) {
        return false; // timeout / DNS failure / connection reset
    }
}

async function deleteCameras(ids) {
    if (ids.length === 0) return;
    const idList = ids.join(',');
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/camera?osm_id=in.(${idList})`, {
            method: 'DELETE',
            headers: SUPA_HEADERS
        });
        if (!res.ok) console.error('Delete failed:', await res.text());
    } catch (e) {
        console.error('Delete network error:', e.message);
    }
}

async function runClean() {
    console.log('=== STRICT CCTV Video-Stream Validation ===');
    console.log('Only keeping cameras that return image/* or video/* content.\n');

    let offset = 0;
    const limit = 200; // smaller batch for stricter checking
    let totalChecked = 0;
    let totalDeleted = 0;

    while (true) {
        const resp = await fetch(
            `${SUPABASE_URL}/rest/v1/camera?select=osm_id,url&limit=${limit}&offset=${offset}`,
            { headers: SUPA_HEADERS }
        );
        if (!resp.ok) { console.error('Fetch error:', await resp.text()); break; }

        const cameras = await resp.json();
        if (cameras.length === 0) break;

        console.log(`\nChecking batch of ${cameras.length} cameras (offset=${offset})...`);
        const toDeleteIds = [];

        // 15 concurrent checks — strict enough not to overload slow endpoints
        for (let i = 0; i < cameras.length; i += 15) {
            const chunk = cameras.slice(i, i + 15);
            const results = await Promise.all(chunk.map(c => checkUrl(c.url)));
            for (let j = 0; j < chunk.length; j++) {
                if (!results[j]) toDeleteIds.push(chunk[j].osm_id);
            }
            process.stdout.write('.');
        }

        const valid = cameras.length - toDeleteIds.length;
        console.log(`\n  ✓ Live streams: ${valid}  ✗ Removed: ${toDeleteIds.length}`);

        for (let i = 0; i < toDeleteIds.length; i += 100) {
            await deleteCameras(toDeleteIds.slice(i, i + 100));
        }

        totalDeleted += toDeleteIds.length;
        totalChecked += cameras.length;

        // If we deleted some entries, the next offset must account for the now-shorter table
        // so we only advance by the number of valid ones we kept
        offset += valid;
    }

    console.log('\n=== Validation Complete ===');
    console.log(`  Checked  : ${totalChecked}`);
    console.log(`  Deleted  : ${totalDeleted}`);
    console.log(`  Remaining: ${totalChecked - totalDeleted}`);
}

runClean();
