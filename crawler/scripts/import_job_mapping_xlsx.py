#!/usr/bin/env python3
"""
Thin wrapper so you can run from the crawler/ directory:

  cd crawler
  python3 scripts/import_job_mapping_xlsx.py ../input/job_mapping_with_selection.xlsx

Delegates to repo root: scripts/import_job_mapping_xlsx.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MAIN = REPO_ROOT / "scripts" / "import_job_mapping_xlsx.py"

if __name__ == "__main__":
    raise SystemExit(
        subprocess.call([sys.executable, str(MAIN)] + sys.argv[1:], cwd=str(REPO_ROOT))
    )
