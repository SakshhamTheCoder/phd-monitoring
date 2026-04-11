import os, re

dir_path = 'client-new/src/components/forms'
components = ['InputField', 'DropdownField', 'FileUploadField', 'DateField', 'TimeField', 'CounterField']

tag_pattern = re.compile(r'<(' + '|'.join(components) + r')\b([^>]*?)>', re.DOTALL)

def update_tag(match):
    name = match.group(1)
    attrs = match.group(2)
    
    if "required=" in attrs:
        return match.group(0)
    
    if "onChange" in attrs:
        # Ignore fields that are explicitly comments or optional
        if "Guest Emails" in attrs or "Leave Blank" in attrs or "Comments" in attrs or "optional" in attrs.lower():
            return match.group(0)
        
        return f'<{name} required={{true}}{attrs}>'
    
    return match.group(0)

count = 0
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith('.js'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = tag_pattern.sub(update_tag, content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                count += 1
                print(f"Modified {filepath}")

print(f"Total modified: {count}")
