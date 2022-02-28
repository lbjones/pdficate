import axios from "axios";
import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

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
  res.send("");
});

interface PrintNode {
  path: string;
  updatedAt: string;
}

app.get("/initiate-sync", (req, res) => {
  // console.dir(req.body, { depth: null });

  if (!req?.body?.context) return res.sendStatus(200);

  let host = req.body.url;
  if (req.body.context === "deploy-preview") host = req.body.deploy_ssl_url;

  console.log("response");
  axios.get(`${host}/print-file-list.json`).then(async (response) => {
    // console.log(response);
    const browser = await puppeteer.launch();
    for (const node of response.data) {
      const filename = `./files${node.path.slice(0, -1)}.pdf`;
      if (node.path !== "/help///") {
        console.log(node.path);
        if (
          !fs.existsSync(filename) ||
          fs.statSync(filename).birthtime < new Date(node.updatedAt)
        ) {
          console.log("get", `${host}${node.path}print/`);
          const html = await axios
            .get(`${host}${node.path}print/`)
            .then((response) => response.data);
          // console.log(html);
          const page = await browser.newPage();
          await page.setContent(html);
          const dir = filename.substring(0, filename.lastIndexOf("/"));
          if (!fs.existsSync(dir)) {
            console.log(`dir ${dir} doesnt exist, creating it...`);
            fs.mkdirSync(dir, { recursive: true });
          }
          await page.pdf({
            format: "letter",
            path: filename,
            margin: {
              top: "32px",
              right: "32px",
              bottom: "32px",
              left: "32px",
            },
            scale: 1,
          });
        } else {
          console.log(
            `pdf for ${filename}, file created ${
              fs.statSync(filename).birthtime
            } last updated ${new Date(node.updatedAt)}`
          );
        }
      }
    }
    await browser.close();
  });

  res.sendStatus(200);
});

app.get("/get-pdf", async (req, res) => {
  console.log(JSON.stringify(req.headers));
  const referrer = req.get("referrer") || "";
  console.log("referrer", referrer);
  const path = new URL(referrer).pathname;
  console.log("path", path.trimEnd);

  const cacheFile = `./files${path.slice(0, -1)}.pdf`;
  console.log(cacheFile);
  if (fs.existsSync(cacheFile)) {
    res.contentType("application/pdf");
    res.send(fs.readFileSync(cacheFile));
    return;
  }

  res.sendStatus(404);
});
