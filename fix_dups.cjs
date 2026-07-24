const fs = require("fs");
const path = "D:/Jishan/Velora/ERPs/frontend/src/services/api.js";
let c = fs.readFileSync(path, "utf8");
let lines = c.split("\n");

// Find all lines that start with "export const" and track duplicates
let seen = new Set();
let removeIndices = new Set();

for (let i = 0; i < lines.length; i++) {
  let m = lines[i].match(/^export const (\w+) =/);
  if (m) {
    if (seen.has(m[1])) {
      // This is a duplicate - mark everything from this export to the next blank line + } for removal
      removeIndices.add(i);
      // Remove until the closing };
      for (let j = i + 1; j < lines.length; j++) {
        removeIndices.add(j);
        if (lines[j].trimEnd().endsWith("};") || lines[j].trimEnd().endsWith("};")) break;
      }
    } else {
      seen.add(m[1]);
    }
  }
}

// Remove marked lines and clean up empty sections
let result = lines.filter((_, i) => !removeIndices.has(i));
// Also remove any consecutive blank lines
result = result.filter((line, i) => !(line.trim() === "" && i > 0 && result[i-1]?.trim() === ""));

fs.writeFileSync(path, result.join("\n"), "utf8");
console.log("Fixed. Remaining exports:", [...seen].join(", "));
