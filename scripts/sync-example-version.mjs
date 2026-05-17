import { readFileSync, writeFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const version = rootPackage.version;
const range = `^${version}`;

function updateJson(path, update) {
	const json = JSON.parse(readFileSync(path, "utf8"));
	update(json);
	writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

updateJson("examples/auth.everything.dev/package.json", (json) => {
	json.workspaces.catalog["better-near-auth"] = range;
	json.dependencies["better-near-auth"] = range;
});

updateJson("examples/auth.everything.dev/plugins/auth/package.json", (json) => {
	json.dependencies["better-near-auth"] = range;
});
