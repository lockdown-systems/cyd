#!/usr/bin/python
import json
import sys


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} [filename.json]")
        return

    filename = sys.argv[1]

    with open(filename) as f:
        automation_error_data = json.load(f)
        body_json = automation_error_data["latestResponseData"]["body"]
        body = json.loads(body_json)
        print(json.dumps(body, indent=2))


if __name__ == "__main__":
    main()
