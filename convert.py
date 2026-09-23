import docx
import os
import glob

files = glob.glob(r'C:\Users\syedi\Downloads\Patent\*.docx')
for f in files:
    try:
        doc = docx.Document(f)
        text = '\n'.join([p.text for p in doc.paragraphs if p.text.strip()])
        out_name = f + '.txt'
        with open(out_name, 'w', encoding='utf-8') as out:
            out.write(text)
        print(f'Converted {f}')
    except Exception as e:
        print(f'Failed {f}: {e}')
