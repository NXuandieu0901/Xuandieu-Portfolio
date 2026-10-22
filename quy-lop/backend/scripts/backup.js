import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
export async function createBackup(source, target) {
  source = resolve(source);
  target = resolve(target);
  if (!existsSync(source))
    throw new Error("Không tìm thấy cơ sở dữ liệu nguồn.");
  if (existsSync(target))
    throw new Error("Tệp đích đã tồn tại; chọn tên khác.");
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, target);
    chmodSync(target, 0o600);
    return target;
  } finally {
    db.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    console.log(
      "Đã sao lưu:",
      await createBackup(
        "data/dongquy.sqlite",
        process.argv[2] ||
          "backups/quy-" +
            new Date().toISOString().replaceAll(":", "-") +
            ".sqlite",
      ),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
