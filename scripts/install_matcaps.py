#!/usr/bin/env python3
import argparse
import concurrent.futures
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple
import json
import urllib.request
import urllib.error


GITHUB_API_DIR_URL = "https://api.github.com/repos/nidorx/matcaps/contents/{res}"

def _print_progress(done: int, total: int, downloaded: int, skipped: int, errors_count: int) -> None:
	# simple single-line progress bar
	width = 40
	ratio = 1.0 if total == 0 else max(0.0, min(1.0, done / total))
	filled = int(ratio * width)
	bar = "#" * filled + "-" * (width - filled)
	msg = f"[{bar}] {done}/{total} d:{downloaded} s:{skipped} e:{errors_count}"
	# carriage return, no newline
	sys.stdout.write("\r" + msg)
	sys.stdout.flush()


def get_repo_root() -> Path:
	# scripts/ is one level under repo root
	return Path(__file__).resolve().parents[1]


def list_matcaps(resolution: str) -> List[Tuple[str, str]]:
	"""
	Return list of tuples: (filename, download_url)
	"""
	url = GITHUB_API_DIR_URL.format(res=resolution)
	req = urllib.request.Request(url, headers={"User-Agent": "dingcad-matcap-installer"})
	try:
		with urllib.request.urlopen(req, timeout=30) as resp:
			data = resp.read()
			items = json.loads(data.decode("utf-8"))
	except urllib.error.HTTPError as e:
		raise SystemExit(f"Failed to list matcaps ({resolution}). HTTP {e.code}: {e.reason}") from e
	except urllib.error.URLError as e:
		raise SystemExit(f"Failed to list matcaps ({resolution}). Network error: {e.reason}") from e

	files: List[Tuple[str, str]] = []
	for item in items:
		if item.get("type") == "file" and isinstance(item.get("name"), str):
			name = item["name"]
			if name.lower().endswith(".png"):
				download_url = item.get("download_url")
				if isinstance(download_url, str) and download_url.startswith("http"):
					files.append((name, download_url))
	return files


def download_one(target_dir: Path, item: Tuple[str, str], overwrite: bool = False) -> Tuple[str, bool, str]:
	"""
	Download a single file. Returns (filename, did_download, error_message_or_empty)
	"""
	name, url = item
	dest = target_dir / name
	if dest.exists() and not overwrite:
		# Skip if already exists and overwrite is False
		return name, False, ""
	tmp_dest = dest.with_suffix(dest.suffix + ".part")
	try:
		req = urllib.request.Request(url, headers={"User-Agent": "dingcad-matcap-installer"})
		with urllib.request.urlopen(req, timeout=60) as resp, open(tmp_dest, "wb") as f:
			# Stream copy
			while True:
				chunk = resp.read(1024 * 128)
				if not chunk:
					break
				f.write(chunk)
		tmp_dest.replace(dest)
		return name, True, ""
	except Exception as e:
		# Clean up partial
		try:
			if tmp_dest.exists():
				tmp_dest.unlink()
		except Exception:
			pass
		return name, False, str(e)


def main() -> None:
	parser = argparse.ArgumentParser(description="Install MatCaps from nidorx/matcaps into viewer/assets/matcaps/<res>.")
	parser.add_argument(
		"--res",
		choices=["512", "1024"],
		default="512",
		help="Resolution set to download (default: 512).",
	)
	parser.add_argument(
		"--overwrite",
		action="store_true",
		help="Re-download files even if they already exist.",
	)
	parser.add_argument(
		"--workers",
		type=int,
		default=min(8, (os.cpu_count() or 4)),
		help="Number of parallel downloads (default: min(8, cpu_count)).",
	)
	args = parser.parse_args()

	repo_root = get_repo_root()
	target_dir = repo_root / "viewer" / "assets" / "matcaps" / args.res
	target_dir.mkdir(parents=True, exist_ok=True)

	print(f"Listing matcaps at resolution {args.res} ...")
	items = list_matcaps(args.res)
	if not items:
		raise SystemExit("No matcaps found to download.")
	print(f"Found {len(items)} PNG files.")

	start_time = time.time()
	num_downloaded = 0
	num_skipped = 0
	errors: List[Tuple[str, str]] = []
	total = len(items)
	done = 0
	_print_progress(done, total, num_downloaded, num_skipped, 0)

	with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
		future_to_name = {
			executor.submit(download_one, target_dir, item, args.overwrite): item[0] for item in items
		}
		for future in concurrent.futures.as_completed(future_to_name):
			name = future_to_name[future]
			try:
				filename, did_download, err = future.result()
				if did_download:
					num_downloaded += 1
				else:
					if err:
						errors.append((filename, err))
					else:
						num_skipped += 1
			except Exception as e:
				errors.append((name, str(e)))
			finally:
				done += 1
				_print_progress(done, total, num_downloaded, num_skipped, len(errors))

	elapsed = time.time() - start_time
	# newline after progress bar
	sys.stdout.write("\n")
	print(f"Done in {elapsed:.1f}s: downloaded {num_downloaded}, skipped {num_skipped}, errors {len(errors)}.")
	if errors:
		print("Some files failed to download:")
		for fname, err in errors[:10]:
			print(f"  - {fname}: {err}")
		if len(errors) > 10:
			print(f"  ... and {len(errors) - 10} more.")
		# Non-zero exit to signal partial failure
		sys.exit(2)


if __name__ == "__main__":
	main()


