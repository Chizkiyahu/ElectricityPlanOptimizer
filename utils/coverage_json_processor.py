import argparse
import json
import os


def read_json_file(file_path):
    """Read and return the JSON data from the file."""
    with open(file_path, 'r') as file:
        return json.load(file)


def extract_covered_lines(text, ranges):
    """Extract lines covered by the given ranges."""
    covered_text = ""
    for range_ in ranges:
        # Extracting parts of the text based on the start and end of each range.
        covered_text += text[range_['start']:range_['end']] + "\n"
    return covered_text


def process_coverage_data(coverage_data, output_dir):
    """Process the coverage data and write the covered lines to separate files."""
    for file_data in coverage_data:
        url = file_data['url']
        file_name = url.split('/')[-1]  # Assuming the file name is the last part of the URL
        output_file_path = f"{output_dir}/{file_name}"

        covered_lines = extract_covered_lines(file_data['text'], file_data['ranges'])

        # Write the covered lines to an output file.
        with open(output_file_path, 'w') as output_file:
            output_file.write(covered_lines)


def main():
    parser = argparse.ArgumentParser(description='Process coverage data.')
    parser.add_argument('json_file_path', help='Path to the JSON file containing the coverage data.')
    parser.add_argument('output_directory', help='Directory to store the output files.')
    args = parser.parse_args()

    os.makedirs(args.output_directory, exist_ok=True)

    # Process the coverage data.
    coverage_data = read_json_file(args.json_file_path)
    process_coverage_data(coverage_data, args.output_directory)

    print(f"Processed coverage data. Covered lines are written to {args.output_directory}.")


if __name__ == '__main__':
    main()
