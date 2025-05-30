import pandas as pd
import os

print(os.getcwd())

# Load BSE data (provided CSV)
bse_df = pd.read_csv('./equity_bse.csv')
bse_mapped = bse_df[['Security Id', 'Issuer Name']].rename(columns={
    'Security Id': 'Symbol',
    'Issuer Name': 'Name'
})

# Load NSE data (assume downloaded CSV)
nse_df = pd.read_csv('./equity_nse.csv')
nse_mapped = nse_df[['SYMBOL', 'NAME OF COMPANY']].rename(columns={
    'SYMBOL': 'Symbol',
    'NAME OF COMPANY': 'Name'
})

# Combine and deduplicate
combined = pd.concat([bse_mapped, nse_mapped])
combined.drop_duplicates(subset=['Symbol'], keep='first', inplace=True)

# Convert to JSON
output = combined.to_json(orient='records', indent=2)

# Save file
with open('equity_bse_nse_combined.json', 'w') as f:
    f.write(output)

print("JSON file created with", len(combined), "entries")