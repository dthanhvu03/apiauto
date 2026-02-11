#!/usr/bin/env python3
"""
Threads HTML Parser
Extracts posts, users, GraphQL queries, and metadata from Threads HTML files.
"""

import json
import re
import csv
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from bs4 import BeautifulSoup


def parse_html(file_path: str) -> BeautifulSoup:
    """Parse HTML file using BeautifulSoup."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return BeautifulSoup(content, 'lxml')


def extract_json_scripts(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """Extract JSON data from script tags."""
    json_data = []
    
    # Find all script tags with type="application/json"
    scripts = soup.find_all('script', type='application/json')
    
    for script in scripts:
        try:
            # Get text content and parse JSON
            text = script.string
            if text:
                data = json.loads(text)
                json_data.append({
                    'raw': data,
                    'content_len': script.get('data-content-len'),
                    'sjs': script.get('data-sjs')
                })
        except (json.JSONDecodeError, AttributeError) as e:
            # Skip invalid JSON
            continue
    
    # Also check for script tags with id="envjson" or id="__eqmc"
    for script_id in ['envjson', '__eqmc']:
        script = soup.find('script', id=script_id)
        if script and script.string:
            try:
                data = json.loads(script.string)
                json_data.append({
                    'raw': data,
                    'script_id': script_id
                })
            except json.JSONDecodeError:
                continue
    
    return json_data


def flatten_nested_dict(data: Any, prefix: str = '') -> Dict[str, Any]:
    """Recursively flatten nested dictionaries."""
    result = {}
    if isinstance(data, dict):
        for key, value in data.items():
            new_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, (dict, list)):
                result.update(flatten_nested_dict(value, new_key))
            else:
                result[new_key] = value
    elif isinstance(data, list):
        for i, item in enumerate(data):
            new_key = f"{prefix}[{i}]" if prefix else f"[{i}]"
            if isinstance(item, (dict, list)):
                result.update(flatten_nested_dict(item, new_key))
            else:
                result[new_key] = item
    else:
        if prefix:
            result[prefix] = data
    return result


def extract_posts(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract post data from GraphQL responses."""
    posts = []
    
    for item in data:
        raw = item.get('raw', {})
        
        # Look for Relay-style data structures
        # Check for require arrays with GraphQL query names
        if isinstance(raw, dict):
            # Look for __bbox structures (Relay format)
            def find_posts_in_obj(obj, path=''):
                if isinstance(obj, dict):
                    # Check for post-like structures
                    if '__typename' in obj:
                        typename = obj.get('__typename', '')
                        if 'Post' in typename or 'Thread' in typename:
                            post = {
                                'id': obj.get('id') or obj.get('__id'),
                                'text': obj.get('text') or obj.get('caption') or obj.get('content'),
                                'author_id': None,
                                'author_username': None,
                                'timestamp': obj.get('timestamp') or obj.get('created_time'),
                                'likes': obj.get('like_count') or obj.get('likes') or obj.get('likeCount'),
                                'comments': obj.get('comment_count') or obj.get('comments') or obj.get('commentCount'),
                                'reposts': obj.get('repost_count') or obj.get('reposts') or obj.get('repostCount'),
                                'shares': obj.get('share_count') or obj.get('shares') or obj.get('num_shares') or obj.get('shareCount'),
                                'typename': typename,
                                'path': path
                            }
                            
                            # Extract author info
                            author = obj.get('author') or obj.get('user') or obj.get('poster')
                            if isinstance(author, dict):
                                post['author_id'] = author.get('id') or author.get('__id')
                                post['author_username'] = author.get('username') or author.get('user_name')
                            
                            posts.append(post)
                    
                    # Recursively search nested objects
                    for key, value in obj.items():
                        if key not in ['__bbox', '__rc']:  # Skip Relay metadata
                            find_posts_in_obj(value, f"{path}.{key}" if path else key)
                
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        find_posts_in_obj(item, f"{path}[{i}]" if path else f"[{i}]")
            
            find_posts_in_obj(raw)
            
            # Also check for BarcelonaHomeContentQuery responses
            if 'require' in raw:
                for req_item in raw.get('require', []):
                    if isinstance(req_item, list) and len(req_item) > 0:
                        query_name = req_item[0]
                        if 'Barcelona' in str(query_name) or 'HomeContent' in str(query_name):
                            # Try to extract data from the response
                            find_posts_in_obj(req_item)
    
    # Remove duplicates based on ID
    seen_ids = set()
    unique_posts = []
    for post in posts:
        post_id = post.get('id')
        if post_id and post_id not in seen_ids:
            seen_ids.add(post_id)
            unique_posts.append(post)
    
    return unique_posts


def extract_users(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract user information."""
    users = []
    seen_ids = set()
    
    for item in data:
        raw = item.get('raw', {})
        
        def find_users_in_obj(obj, path=''):
            if isinstance(obj, dict):
                # Check for user-like structures
                if '__typename' in obj:
                    typename = obj.get('__typename', '')
                    if 'User' in typename or 'Viewer' in typename or 'Profile' in typename:
                        user_id = obj.get('id') or obj.get('__id') or obj.get('user_id')
                        if user_id and user_id not in seen_ids:
                            seen_ids.add(user_id)
                            user = {
                                'id': user_id,
                                'username': obj.get('username') or obj.get('user_name') or obj.get('screen_name'),
                                'display_name': obj.get('display_name') or obj.get('full_name') or obj.get('name'),
                                'profile_url': obj.get('profile_url') or obj.get('url'),
                                'typename': typename,
                                'path': path
                            }
                            users.append(user)
                
                # Recursively search
                for key, value in obj.items():
                    if key not in ['__bbox', '__rc']:
                        find_users_in_obj(value, f"{path}.{key}" if path else key)
            
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    find_users_in_obj(item, f"{path}[{i}]" if path else f"[{i}]")
        
        find_users_in_obj(raw)
    
    return users


def extract_graphql(data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract GraphQL queries and mutations."""
    graphql_items = []
    
    for item in data:
        raw = item.get('raw', {})
        
        def find_graphql_in_obj(obj, path=''):
            if isinstance(obj, dict):
                # Look for GraphQL query names in require arrays
                if 'require' in obj:
                    for req_item in obj.get('require', []):
                        if isinstance(req_item, list) and len(req_item) > 0:
                            query_name = req_item[0]
                            if isinstance(query_name, str) and ('.graphql' in query_name or 'Query' in query_name or 'Mutation' in query_name):
                                graphql_item = {
                                    'query_name': query_name,
                                    'type': 'Mutation' if 'Mutation' in query_name else 'Query',
                                    'parameters': req_item[1] if len(req_item) > 1 else None,
                                    'path': path
                                }
                                graphql_items.append(graphql_item)
                
                # Recursively search
                for key, value in obj.items():
                    if key not in ['__bbox', '__rc']:
                        find_graphql_in_obj(value, f"{path}.{key}" if path else key)
            
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    find_graphql_in_obj(item, f"{path}[{i}]" if path else f"[{i}]")
        
        find_graphql_in_obj(raw)
    
    return graphql_items


def extract_metadata(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Extract metadata, config, and feature flags."""
    metadata = {
        'feature_flags': {},
        'config': {},
        'environment': {},
        'performance': {},
        'urls': [],
        'other': {}
    }
    
    for item in data:
        raw = item.get('raw', {})
        
        def extract_from_obj(obj, path=''):
            if isinstance(obj, dict):
                # Extract feature flags (gkxData)
                if 'gkxData' in obj:
                    metadata['feature_flags'].update(obj['gkxData'])
                
                # Extract config (metaconfigData)
                if 'metaconfigData' in obj:
                    metadata['config'].update(obj['metaconfigData'])
                
                # Extract environment variables
                if 'useTrustedTypes' in obj or 'routing_namespace' in obj:
                    metadata['environment'].update(obj)
                
                # Extract URLs
                if 'uri' in obj or 'url' in obj:
                    url = obj.get('uri') or obj.get('url')
                    if url and url not in metadata['urls']:
                        metadata['urls'].append(url)
                
                # Extract performance data (qplData)
                if 'qplData' in obj:
                    metadata['performance'].update(obj['qplData'])
                
                # Extract other metadata
                for key in ['bxData', 'clpData', 'ixData', 'qexData', 'justknobxData']:
                    if key in obj:
                        metadata['other'][key] = obj[key]
                
                # Recursively search
                for key, value in obj.items():
                    if key not in ['__bbox', '__rc']:
                        extract_from_obj(value, f"{path}.{key}" if path else key)
            
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    extract_from_obj(item, f"{path}[{i}]" if path else f"[{i}]")
        
        extract_from_obj(raw)
    
    return metadata


def save_results(data: Dict[str, Any], output_dir: str = 'output'):
    """Save extracted data to JSON and CSV files."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Save posts
    if data.get('posts'):
        posts_file = os.path.join(output_dir, 'posts.json')
        with open(posts_file, 'w', encoding='utf-8') as f:
            json.dump(data['posts'], f, indent=2, ensure_ascii=False)
        
        # Also save as CSV
        if data['posts']:
            posts_csv = os.path.join(output_dir, 'posts.csv')
            with open(posts_csv, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=data['posts'][0].keys())
                writer.writeheader()
                writer.writerows(data['posts'])
    
    # Save users
    if data.get('users'):
        users_file = os.path.join(output_dir, 'users.json')
        with open(users_file, 'w', encoding='utf-8') as f:
            json.dump(data['users'], f, indent=2, ensure_ascii=False)
        
        # Also save as CSV
        if data['users']:
            users_csv = os.path.join(output_dir, 'users.csv')
            with open(users_csv, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=data['users'][0].keys())
                writer.writeheader()
                writer.writerows(data['users'])
    
    # Save GraphQL queries
    if data.get('graphql_queries'):
        graphql_file = os.path.join(output_dir, 'graphql_queries.json')
        with open(graphql_file, 'w', encoding='utf-8') as f:
            json.dump(data['graphql_queries'], f, indent=2, ensure_ascii=False)
        
        # Save raw queries to text file
        queries_text = os.path.join(output_dir, 'graphql_queries.txt')
        with open(queries_text, 'w', encoding='utf-8') as f:
            for query in data['graphql_queries']:
                f.write(f"Query: {query.get('query_name', 'Unknown')}\n")
                f.write(f"Type: {query.get('type', 'Unknown')}\n")
                f.write(f"Path: {query.get('path', 'Unknown')}\n")
                if query.get('parameters'):
                    f.write(f"Parameters: {json.dumps(query['parameters'], indent=2)}\n")
                f.write("\n" + "="*80 + "\n\n")
    
    # Save metadata
    if data.get('metadata'):
        metadata_file = os.path.join(output_dir, 'metadata.json')
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(data['metadata'], f, indent=2, ensure_ascii=False)
    
    print(f"Results saved to {output_dir}/")
    print(f"  - posts.json, posts.csv")
    print(f"  - users.json, users.csv")
    print(f"  - graphql_queries.json, graphql_queries.txt")
    print(f"  - metadata.json")


def main():
    """Main function to run the parser."""
    import sys
    
    # Default input file
    input_file = 't.txt'
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    
    if not os.path.exists(input_file):
        print(f"Error: File '{input_file}' not found.")
        sys.exit(1)
    
    print(f"Parsing {input_file}...")
    
    # Parse HTML
    soup = parse_html(input_file)
    print("✓ HTML parsed")
    
    # Extract JSON scripts
    json_data = extract_json_scripts(soup)
    print(f"✓ Found {len(json_data)} JSON script tags")
    
    # Extract data
    print("\nExtracting data...")
    posts = extract_posts(json_data)
    print(f"✓ Extracted {len(posts)} posts")
    
    users = extract_users(json_data)
    print(f"✓ Extracted {len(users)} users")
    
    graphql_queries = extract_graphql(json_data)
    print(f"✓ Extracted {len(graphql_queries)} GraphQL queries")
    
    metadata = extract_metadata(json_data)
    print(f"✓ Extracted metadata")
    print(f"  - Feature flags: {len(metadata.get('feature_flags', {}))}")
    print(f"  - Config values: {len(metadata.get('config', {}))}")
    print(f"  - URLs: {len(metadata.get('urls', []))}")
    
    # Save results
    results = {
        'posts': posts,
        'users': users,
        'graphql_queries': graphql_queries,
        'metadata': metadata
    }
    
    save_results(results)
    print("\n✓ Done!")


if __name__ == '__main__':
    main()
