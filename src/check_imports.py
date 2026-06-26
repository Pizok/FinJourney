import os
import sys
import glob
import importlib

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root_dir)
    sys.path.insert(0, root_dir)
    
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    print("Checking imports for all Python files in the app/ folder...")
    
    errors = []
    success_count = 0
    
    for file_path in glob.glob("app/**/*.py", recursive=True):
        if "__pycache__" in file_path:
            continue
            
        module_name = file_path.replace("\\", ".").replace("/", ".")[:-3]
        if module_name.endswith(".__init__"):
            module_name = module_name[:-9]
            if not module_name:
                continue
                
        try:
            importlib.import_module(module_name)
            success_count += 1
        except ImportError as e:
            errors.append(f"{module_name} -> {e}")
        except Exception as e:
            # We also catch other exceptions like SyntaxError that might break import
            errors.append(f"{module_name} -> {type(e).__name__}: {e}")

    # Print results
    if errors:
        print(f"\nFound {len(errors)} import issues:")
        for err in set(errors):
            print(f" - {err}")
    else:
        print(f"\nAll {success_count} modules imported successfully! No broken links found.")

if __name__ == "__main__":
    main()
