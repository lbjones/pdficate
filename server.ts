import axios from "axios";
import express from "express";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT;

const logCopy = console.log.bind(console);
console.log = function (data) {
  var date = "[" + new Date().toUTCString() + "] ";
  if (arguments?.length > 1) logCopy(date, arguments);
  else logCopy(date, data);
};
interface PrintNode {
  path: string;
  updatedAt: string;
}

const PrintEnvs = ["production", "preview", "localhost"] as const;
type PrintEnv = typeof PrintEnvs[number];

app.listen(port, () => {
  console.log(`The PDFicator is listening on port ${port}`);
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

app.post("/initiate-sync", (req, res) => {
  console.dir(req.body, { depth: null });

  if (!req?.body?.context && !req?.body?.deployPreviewUrl)
    return res.sendStatus(200);

  let host = "";
  let env: PrintEnv;

  // this means we only build on the master branch
  if (
    req.body.deployPreviewUrl !== "https://bitwarden.gatsbyjs.io" &&
    req.body.resourceId !== "297ba62a-6755-4891-80ba-ec7ef8299d79"
  ) {
    console.log("Not a production deploy.");
    return res.sendStatus(200);
  }

  if (req.body.event === "BUILD_SUCCEEDED") {
    host = "https://bitwarden.com";
    env = "production";
  } else if (req.body.event === "PREVIEW_SUCCEEDED") {
    host = "https://preview-bitwarden.gatsbyjs.io";
    env = "preview";
  } else {
    console.log(`Unknown event type: ${req.body.event}`);
    return res.sendStatus(200);
  }

  generatePdfs(host, env);

  res.sendStatus(200);
});

app.get("/man-sync", (req, res) => {
  const { host, env, key } = req.query;

  if (process.env.KEY !== key || !PrintEnvs.includes(env as PrintEnv) || !host)
    return res.sendStatus(404);

  console.log(`manually syncing pdfs:`, req.query);

  generatePdfs(host as string, env as PrintEnv);

  res.sendStatus(200);
});

app.get("/clear-cache", (req, res) => {
  const { host, env, key } = req.query;

  if (process.env.KEY !== key || !PrintEnvs.includes(env as PrintEnv) || !host)
    return res.sendStatus(404);

  console.log(`clearing cache:`, req.query);

  generatePdfs(host as string, env as PrintEnv, true);

  res.sendStatus(200);
});

const generatePdfs = (host: string, env: PrintEnv, doAll = false) => {
  const listingUrl = `${host}/print-list.json`;
  console.log(`generatePdfs: ${listingUrl} for env: ${env}`);

  axios
    .get(listingUrl)
    .then(async (response) => {
      for (const node of response.data) {
        const printNode = node as PrintNode;
        const filename = `./pdfs/${env}${node.path.slice(0, -1)}.pdf`;
        if (
          doAll ||
          !fs.existsSync(filename) ||
          fs.statSync(filename).mtime < new Date(printNode.updatedAt)
        ) {
          const printUrl = `${host}${printNode.path}?print`;
          console.log(`refreshing: ${printUrl}`);

          await pdfication(printUrl, filename);
        }
      }
      console.log("...and done");
    })
    .catch((e) => console.log(e, "Error...could not retrieve listing file"));
};

app.get("/get-pdf", async (req, res) => {
  const route = req.query.path;
  const referrer = (req.get("referrer") || "").toLowerCase();
  console.log(`getting: ${route} for ${referrer}`);
  if (!route || typeof route !== "string") return res.sendStatus(404);

  let env: PrintEnv = "production";
  if (referrer.includes("localhost") || process.env.ENV === "dev")
    env = "localhost";
  else if (referrer.includes("preview")) env = "preview";
  else if (referrer.includes("gtsb.io")) env = "preview";

  const file = `./pdfs/${env}${route.slice(0, -1)}.pdf`;
  if (env === "localhost")
    await pdfication("http://localhost:8000" + route + "?print", file);
  if (!fs.existsSync(file)) return res.sendStatus(404);

  return res.download(file);
});

app.get("/get-dynamic-pdf", async (req, res) => {
  const route = (req.query.path as string) || "";
  const referrer = req.get("referrer") || "";

  console.log(`getting: ${route} for ${referrer}`);

  // make sure we are not pdf-icating just anything
  if (
    process.env.ENV === "production" &&
    (!route.includes("/sales-quote/") ||
      !referrer?.includes("https://bitwarden.com"))
  )
    return res.sendStatus(404);

  return res.download(
    await pdfication(
      `${referrer.slice(0, -1)}${route}&print`,
      `./pdfs/${process.env.ENV}/${
        route.split("/")[1]
      }/${new Date().toISOString()}.pdf`
    )
  );
});

const pdfication = async (url: string, filename: string) => {
  console.log(`pdficating: ${url}`);
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle0",
  });
  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    console.log(`dir ${dir} doesnt exist, creating it...`);
    fs.mkdirSync(dir, { recursive: true });
  }
  await page.pdf({
    format: "letter",
    path: filename,
    margin: {
      top: "24px",
      right: "24px",
      bottom: "24px",
      left: "24px",
    },
    timeout: 30000,
    omitBackground: false,
    printBackground: true,
    scale: 1,
  });

  await browser.close();

  const realpath = fs.realpathSync(filename);

  console.log(`pdficated: ${realpath}`);

  return realpath;
};

app.get("/og-image", async (req, res) => {
  const referrer = req.get("referrer") || "";
  const route = (req.query.path as string) || "";

  console.log(`og-image: getting ${route} for ${referrer}`);

  // make sure we are not pdf-icating just anything
  if (
    process.env.ENV === "production" &&
    (!route.includes("og/") || !referrer?.includes("https://bitwarden.com"))
  )
    return res.sendStatus(404);

  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.goto(`${route}&print=true`, {
    waitUntil: "networkidle0",
  });
  const element = await page.$("#main-img");
  const image = await element?.screenshot({ type: "png" });
  browser.close();

  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": `public, max-age=0, must-revalidate`,
  });

  return res.end(image);
});
