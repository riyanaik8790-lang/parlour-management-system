const headers = { "Content-Type": "application/json" };
async function run() {
  try {
    const login = await fetch("https://parlour-backend.onrender.com/api/login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: "patilh3845@gmail.com", password: "Password@123" }),
    });
    const data = await login.json();
    headers["Authorization"] = "Bearer " + data.token;

    const get = await fetch("https://parlour-backend.onrender.com/api/profile", {
      headers,
    });
    console.log("GET STATUS:", get.status);
    console.log("GET BODY:", await get.text());
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
run();
