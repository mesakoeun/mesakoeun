import pandas as pd

# Load the CSV
df = pd.read_csv('kh-places.csv')
sql_statements = []

# Manual mapping for Province (since CSV starts at District level)
# Using Latin name for the province
province_names = {1: 'Banteay Meanchey'} 

found_pids = set()

for _, row in df.iterrows():
    # SWAP: Changed from 'Name (Khmer)' to 'Name (Latin)'
    # We also use .strip() to remove any accidental spaces
    name = str(row['Name (Latin)']).replace("'", "''").strip()
    code = str(row['Code'])
    
    if row['Type'] in ['ស្រុក', 'ក្រុង']: # District
        did = int(code.zfill(4))
        pid = int(code.zfill(4)[:2])
        # Add Province if not already added
        if pid not in found_pids:
            pname = province_names.get(pid, f"Province {pid}").replace("'", "''")
            sql_statements.append(f"INSERT IGNORE INTO tbl_province (id, name) VALUES ({pid}, '{pname}');")
            found_pids.add(pid)
        sql_statements.append(f"INSERT IGNORE INTO tbl_district (id, province_id, name) VALUES ({did}, {pid}, '{name}');")
        
    elif row['Type'] in ['ឃុំ', 'សង្កាត់']: # Commune
        cid = int(code.zfill(6))
        did = int(code.zfill(6)[:4])
        pid = int(code.zfill(6)[:2])
        sql_statements.append(f"INSERT IGNORE INTO tbl_commune (id, province_id, district_id, name) VALUES ({cid}, {pid}, {did}, '{name}');")
        
    elif row['Type'] == 'ភូមិ': # Village
        vid = int(code.zfill(8))
        cid = int(code.zfill(8)[:6])
        did = int(code.zfill(8)[:4])
        pid = int(code.zfill(8)[:2])
        sql_statements.append(f"INSERT IGNORE INTO tbl_village (id, province_id, district_id, commune_id, name) VALUES ({vid}, {pid}, {did}, {cid}, '{name}');")

# Save to file
with open('insert_places_latin.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print(f"Success! Generated {len(sql_statements)} lines in insert_places_latin.sql")
