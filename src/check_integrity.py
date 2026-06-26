import os
import re
from pathlib import Path

def validate_imports():
    root = Path("./app")
    broken_links = []
    
    # Regex to find: from app.x.y import ... or from journey.x.y import ...
    import_pattern = re.compile(r"from (app|journey)\.([\w\.]+) import")

    for py_file in root.rglob("*.py"):
        with open(py_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                match = import_pattern.search(line)
                if match:
                    prefix, module_path = match.groups()
                    
                    # 1. Flag legacy 'journey' imports immediately
                    if prefix == 'journey':
                        broken_links.append(f"LEGACY PATH: {py_file}:{i+1} -> 'from journey.{module_path}'")
                        continue

                    # 2. Check if 'app.x.y' exists as a file or folder
                    target_file = Path("./") / (prefix + "/" + module_path.replace(".", "/") + ".py")
                    target_dir = Path("./") / (prefix + "/" + module_path.replace(".", "/"))
                    if not target_file.exists() and not (target_dir.is_dir() and (target_dir / "__init__.py").exists()):
                        broken_links.append(f"MISSING FILE: {py_file}:{i+1} -> {target_file}")

    if broken_links:
        print(f"Found {len(broken_links)} broken links:")
        for link in broken_links:
            print(link)
    else:
        print("Integrity Verified: All import paths resolve to existing files.")

if __name__ == "__main__":
    validate_imports()