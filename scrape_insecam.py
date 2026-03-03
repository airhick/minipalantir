import requests
import re
import time
import json
import random

# Supabase Credentials (from minipalantir app)
SUPABASE_URL = "https://thfbkakbbszvgbkicssx.supabase.co"
SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZmJrYWtiYnN6dmdia2ljc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MzUxOTEsImV4cCI6MjA4MjAxMTE5MX0.nMzv5oOThART2Q5e40RGtIeq0F3vz2X2M7mUtWXUQEo"

HEADERS = {
    "apikey": SUPABASE_ANON,
    "Authorization": f"Bearer {SUPABASE_ANON}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

# Web scraper headers
SCRAPE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_html(url, retries=3):
    for i in range(retries):
        try:
            resp = requests.get(url, headers=SCRAPE_HEADERS, timeout=10)
            if resp.status_code == 200:
                return resp.text
            elif resp.status_code in [403, 429]:
                print(f"Got {resp.status_code} on {url}. Waiting...")
                time.sleep(2 * (i + 1))
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            time.sleep(2)
    return None

def scrape_camera_details(cam_id):
    url = f"http://www.insecam.org/en/view/{cam_id}/"
    html = get_html(url)
    if not html:
        return None

    try:
        # Extract stream URL
        stream_m = re.search(r'<img id="image.*? src="(.*?)"', html)
        if not stream_m:
            return None
        stream_url = stream_m.group(1)

        # Extract Latitude
        lat_m = re.search(r'Latitude.*?<div.*?>(.*?)</div>', html, re.DOTALL)
        if not lat_m:
            return None
        lat = float(lat_m.group(1).strip())

        # Extract Longitude
        lon_m = re.search(r'Longitude.*?<div.*?>(.*?)</div>', html, re.DOTALL)
        if not lon_m:
            return None
        lon = float(lon_m.group(1).strip())

        # Extract City
        city_m = re.search(r'City.*?<div.*?>(.*?)</div>', html, re.DOTALL)
        city = city_m.group(1).strip() if city_m else None
        
        # We don't want to insert broken/bogus coordinates
        if lat == 0.0 and lon == 0.0:
            return None

        # Hash the insecam ID to create a stable negative ID (avoids OSM collisions)
        osm_id = -abs(hash(f"insecam_{cam_id}")) % 1000000000

        return {
            "osm_id": osm_id,
            "lat": lat,
            "lon": lon,
            "name": f"Insecam {cam_id}",
            "url": stream_url,
            "operator": "Insecam",
            "city": city,
            "surveillance_type": "public",
            "camera_type": "ip"
        }
    except Exception as e:
        print(f"Failed parsing {cam_id}: {e}")
        return None

def upsert_to_supabase(cameras):
    if not cameras:
        return
    try:
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/camera", headers=HEADERS, json=cameras)
        if resp.status_code in [200, 201]:
            print(f"Successfully inserted {len(cameras)} cameras to Supabase.")
        else:
            print(f"Supabase insert failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error connecting to Supabase: {e}")

def run():
    print("Starting Insecam scraper...")
    # Scrape first 20 pages
    for page in range(1, 21):
        print(f"Scraping page {page}...")
        url = f"http://www.insecam.org/en/byrating/?page={page}"
        html = get_html(url)
        if not html:
            continue
        
        cam_ids = re.findall(r'href="/en/view/(\d+)/"', html)
        # Deduplicate
        cam_ids = list(set(cam_ids))
        print(f"Found {len(cam_ids)} unique cameras on page {page}.")

        db_records = []
        for cid in cam_ids:
            cam = scrape_camera_details(cid)
            if cam:
                db_records.append(cam)
            # Be polite to the server
            time.sleep(random.uniform(0.5, 1.5))

        if db_records:
            upsert_to_supabase(db_records)
            
if __name__ == "__main__":
    run()
