#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Thu Nov 19 19:33:01 2019

@author: eltrujo
"""

from os.path import sep
import requests
import csv

COUNTRY = 'Spain'
COUNTRY_CODE = 724

year_range = range(1950, 2101)

for year in year_range:

    url = f"https://www.populationpyramid.net/api/pp/{COUNTRY_CODE}/{year}/?csv=true"

    resp = requests.get(url)

    if resp.status_code == 200:

        with open(f"data{sep}{COUNTRY}{sep}{year}.csv", 'w') as f:
            writer = csv.writer(f)
            for line in resp.iter_lines():
                writer.writerow(line.decode('utf-8').split(','))

        print(f"{COUNTRY} {year} downloaded")

    else:
        print(f"{COUNTRY} {year} NOT downloaded")
