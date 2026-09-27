const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Pinoy Buy and Sell is online</h1>");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
