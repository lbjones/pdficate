import axios from "axios";
import express from "express";
import fs from "fs";
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

app.post("/initiate-sync", (req, res) => {
  console.dir(req.body, { depth: null });

  if (!req?.body?.context && !req?.body?.deployPreviewUrl)
    return res.sendStatus(200);

  let host = "";
  let env: PrintEnv;

  // Netlify logic ... now extinct 4/28/2022
  // if (req.body.context === "production") {
  //   env = "production";
  //   host = req.body.ssl_url;
  // } else if (
  //   req.body.context === "deploy-preview" ||
  //   req.body.context === "branch-deploy"
  // ) {
  //   env = "preview";
  //   host = req.body.deploy_ssl_url;
  // }

  // this means we only build on the master branch
  if (req.body.deployPreviewUrl !== "https://bitwarden.gtsb.io") {
    console.log("Not a production deploy.");
    return res.sendStatus(200);
  }

  if (req.body.event === "BUILD_SUCCEEDED") {
    host = "https://bitwarden.gtsb.io";
    env = "production";
  } else if (req.body.event === "PREVIEW_SUCCEEDED") {
    host = "https://preview-bitwarden.gtsb.io";
    env = "preview";
  } else {
    console.log(`Unknown event type: ${req.body.event}`);
    return res.sendStatus(200);
  }

  generatePdfs(host, env);

  res.sendStatus(200);
});

app.get("/clear-cache", (req, res) => {
  const { host, env, key } = req.query;

  if (process.env.KEY !== key || !PrintEnvs.includes(env as PrintEnv) || !host)
    return res.sendStatus(404);

  console.log(`clearing cache:`, req.query);

  fs.rmSync(`./pdfs/${env}`, { recursive: true, force: true });

  generatePdfs(host as string, env as PrintEnv);

  res.sendStatus(200);
});

const generatePdfs = (host: string, env: PrintEnv) => {
  const listingUrl = `${host}/print-file-list.json`;
  console.log(`generatePdfs: ${listingUrl} for env: ${env}`);
  axios
    .get(listingUrl)
    .then(async (response) => {
      const browser = await puppeteer.launch();
      for (const node of response.data) {
        const printNode = node as PrintNode;
        const filename = `./pdfs/${env}${node.path.slice(0, -1)}.pdf`;
        if (
          !fs.existsSync(filename) ||
          fs.statSync(filename).birthtime < new Date(printNode.updatedAt)
        ) {
          const printUrl = `${host}${printNode.path}print/`;
          console.log(`refreshing: ${printUrl}`);
          const html = await axios
            .get(printUrl)
            .then((response) => response.data)
            .catch(() =>
              console.log("Error...could not retrieve that last one")
            );
          if (html) {
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
          }
        }
      }
      console.log("...and done");
      await browser.close();
    })
    .catch(() => console.log("Error...could not retrieve listing file"));
};

app.get("/get-pdf", async (req, res) => {
  const path = req.query.path;
  const referrer = (req.get("referrer") || "").toLowerCase();
  console.log(`getting: ${path} for ${referrer}`);
  if (!path || typeof path !== "string") return res.sendStatus(404);

  let env: PrintEnv = "production";
  if (referrer.includes("localhost")) env = "localhost";
  else if (referrer.includes("preview")) env = "preview";
  else if (referrer.includes("gtsb.io")) env = "preview";

  const file = `./pdfs/${env}${path.slice(0, -1)}.pdf`;
  if (!fs.existsSync(file)) return res.sendStatus(404);

  console.log(`got: ${file}`);
  return res.download(file);
});
