from flask import Flask, jsonify , render_template , redirect, request, url_for 
import sqlite3

"""

    db_conn = sqlite3.connect('sql.db')
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM Items")
    rows = cursor.fetchall()
    db_conn.close()
    data = []

    for row in rows:

        remarks = row[5]
        if row[5] == None:
            remarks = ""

        data.append({
            "ItemID": row[0],
            "Code": row[1],
            "Category": row[2],
            "Type": row[3],
            "Status": row[4],
            "Remarks": remarks
        })

print(data)"""
conn = sqlite3.connect("sql.db")
conn.row_factory = sqlite3.Row

cursor = conn.cursor()

query = """
SELECT Log.LogID,
       Borrower.BorrowerName,
       Items.Code,
       Log.DateBorrowed,
       Log.ExpectedReturnDate

FROM Log

INNER JOIN Borrower
ON Log.SchoolID = Borrower.SchoolID

INNER JOIN Items
ON Log.ItemID = Items.ItemID
"""

cursor.execute(query)

results = cursor.fetchall()

print(results[2]['BorrowerName'])
""""
for row in results:
    print("Log ID:", row["LogID"])
    print("Borrower:", row["BorrowerName"])
    print("Item Code:", row["Code"])
    print("Date Borrowed:", row["DateBorrowed"])
    print("Date Expected Return:", row["ExpectedReturnDate"])
    print("-------------------")"""