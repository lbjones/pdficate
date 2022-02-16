const express = require("express");
const puppeteer = require("puppeteer");
const { performance } = require("perf_hooks");
const axios = require("axios");

const app = express();
const port = 8087;

app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.post("/get-pdf", async (req, res) => {
  console.log("ehhhhhh");

  if (
    process.env.NODE_ENV === "production" &&
    req.get("origin") !== "https://bitwarden.com"
  )
    return res.status(401).send("Unauthorized");

  console.log("haaaa");

  // console.dir(req, { depth: null });
  console.log("starting", req.body.updatedAt);
  var startTime = performance.now();

  const printUrl = `${req.get("origin")}${req.body.path}print/`;
  console.log(printUrl);
  const print = await axios.get(printUrl);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  console.dir(print.data, { depth: null });

  // 1. Create PDF from URL
  await page.setContent(print.data);
  const pdf = await page.pdf({ format: "letter" });

  // 2. Create PDF from static HTML

  await browser.close();

  console.log("end");
  var endTime = performance.now();
  console.log(`Call to doSomething took ${endTime - startTime} milliseconds`);

  res.contentType("application/pdf");
  res.send(pdf);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
