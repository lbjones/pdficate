import express from "express";
import puppeteer from "puppeteer";

import fs from "fs";
import path from "path";

const app = express();
const port = 8087;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.use(express.json({ limit: "2MB" }));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/", (req, res) => {
  console.log("home request");
  res.send("hello sir");
});

app.post("/initiate-sync", (req, res) => {
  console.dir(req.body, { depth: 1 });
  res.sendStatus(200);
});

app.get("/get-pdf", async (req, res) => {
  console.dir(req, { depth: null });

  //  if (
  //    process.env.NODE_ENV === "production" &&
  //    req.get("origin") !== "https://bitwarden.com"
  //  )
  //    return res.status(401).send("Unauthorized");

  //  console.log("haaaa");

  // console.dir(req, { depth: null });
  console.log("starting", req.body.updatedAt);
  console.log("origin", req.get("origin"));

  const cacheFile = `./cache${req.body.path}${req.body.updatedAt}.pdf`;
  console.log(cacheFile);
  if (fs.existsSync(cacheFile)) {
    res.contentType("application/pdf");
    res.send(fs.readFileSync(cacheFile));
    return;
  }
  //fs.writeFile(

  //  const printUrl = `${req.get("origin")}${req.body.path}print/`;
  //  console.log(printUrl);
  //  const print = await axios.get(printUrl);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  //  console.dir(print.data, { depth: null });

  // 1. Create PDF from URL
  await page.setContent(req?.body?.html);
  const pdf = await page.pdf({
    format: "letter",
    margin: { top: "32px", right: "32px", bottom: "32px", left: "32px" },
    scale: 1,
  });

  // 2. Create PDF from static HTML

  await browser.close();

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, pdf);

  console.log("end");
  //  var endTime = performance.now();
  //  console.log(`Call to doSomething took ${endTime - startTime} milliseconds`);

  res.contentType("application/pdf");
  res.send(pdf);
});
