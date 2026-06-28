const http = require("http");

// Test the browser control server on port 19003
const req = http.get("http://127.0.0.1:19003/", (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log("Headers:", JSON.stringify(res.headers, null, 2));
    console.log("Body:", data.substring(0, 500));
  });
});
req.on("error", (err) => console.error("Error:", err.message));
req.end();
