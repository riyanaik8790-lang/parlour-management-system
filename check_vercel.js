async function run() {
  const htmlRes = await fetch("https://parlour-management-system-blond.vercel.app/");
  const html = await htmlRes.text();
  const jsMatch = html.match(/src="(\/assets\/index-[^\"]+\.js)"/);
  if (jsMatch) {
    const jsUrl = "https://parlour-management-system-blond.vercel.app" + jsMatch[1];
    const jsRes = await fetch(jsUrl);
    const js = await jsRes.text();
    console.log("Includes VAPID string?", js.includes("VITE_VAPID_PUBLIC_KEY"));
    const b64Regex = /"([A-Za-z0-9_-]{87})"/;
    const match = js.match(b64Regex);
    if (match) console.log("Found 87-char base64 string:", match[1]);
    else console.log("No VAPID key found!");
  }
}
run();
