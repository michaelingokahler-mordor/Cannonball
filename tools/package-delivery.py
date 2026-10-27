"""Create a portable ZIP from the last verified package; verify every CRC."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / "output/windows/latest.json").read_text(encoding="utf-8-sig"))
package = Path(metadata["outputDirectory"]).resolve()
if not package.is_relative_to((root / "output/windows").resolve()):
    raise RuntimeError("Package is outside the intended output directory")
destination = root / "output" / f"Cannonball-PA-Windows-{metadata['buildId']}.zip"
with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for entry in sorted(package.rglob("*")):
        if entry.is_symlink():
            raise RuntimeError("Refusing a symlink in the package")
        if entry.is_file():
            archive.write(entry, Path("Cannonball-PA-Windows") / entry.relative_to(package))
    archive.write(root / "README.md", "Cannonball-PA-Windows/README.md")
with zipfile.ZipFile(destination) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f"Bad ZIP entry: {bad}")
    entries = len(archive.infolist())
with destination.open("rb") as source:
    digest = hashlib.file_digest(source, "sha256").hexdigest()
result = {"zip": str(destination), "bytes": destination.stat().st_size, "entries": entries,
          "crc": "passed", "sha256": digest, "buildId": metadata["buildId"]}
(root / "output/qa/delivery.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
