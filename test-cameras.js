import { fetchGlobalCameras } from './src/api/cameras.ts';
async function test() {
  const data = await fetchGlobalCameras();
  console.log("Found:", data.features.length);
}
test();
