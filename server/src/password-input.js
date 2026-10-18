export async function readHiddenPassword() {
  if (process.env.POS_USER_PASSWORD) return process.env.POS_USER_PASSWORD;
  if (!process.stdin.isTTY) throw new Error("Set POS_USER_PASSWORD when no terminal is available.");
  process.stdout.write("Password (12+ characters): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let password = "";
  return new Promise((resolve, reject) => {
    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    }
    function onData(chunk) {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") return finish(new Error("Cancelled."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
        else password += char;
      }
    }
    process.stdin.on("data", onData);
  });
}
