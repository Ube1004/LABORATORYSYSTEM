from flask import Flask, jsonify, render_template, redirect, request, url_for
import sqlite3
import logging
from datetime import datetime
from flask import session
import base64
import os
from werkzeug.security import generate_password_hash, check_password_hash
from pathlib import Path


app = Flask(__name__)
app.secret_key = "supersecretkey"


# ============================================================
# DATABASE PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "sql.db"


# ============================================================
# RENDERING PAGES
# ============================================================

@app.route('/login', methods=['POST'])
def login():

    data = request.get_json()

    username = data.get('username')
    password = str(data.get('password'))

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM Users
        WHERE Name = ?
    """, (username,))

    user = cur.fetchone()

    conn.close()

    if user and check_password_hash(user["Password"], password):

        session['username'] = user['Name']
        session['role'] = user['Status']
        session['userId'] = user['UserID']

        print("LOGIN SESSION:", dict(session))

        return jsonify({
            "success": True,
            "username": user['Name'],
            "role": user['Status'],
            "userId": user['UserID']
        })

    return jsonify({
        "success": False,
        "message": "Invalid username or password."
    }), 401

@app.route('/logout')
def logout():
    session.clear()
    return render_template('login.html')


@app.route('/gotologin')
def gotologin():
    return render_template('login.html')


@app.route('/getItem', methods=['POST'])
def getItem():

    data = request.get_json()
    ItemId = data.get('itemId')

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM Items WHERE ItemID = ?
    """, (ItemId,))

    item = cursor.fetchone()

    cursor.execute("""
        SELECT * FROM Items WHERE Type = ? AND Status = ?
    """, (item["Type"], "AVAILABLE",))

    available = cursor.fetchall()

    cursor.execute("""
        SELECT * FROM Items WHERE Type = ? AND Status = ?
    """, (item["Type"], "BORROWED",))

    borrowed = cursor.fetchall()

    cursor.execute("""
        SELECT * FROM Items
        WHERE Type = ? AND Status NOT IN ("AVAILABLE", "BORROWED")
    """, (item["Type"], ))

    other = cursor.fetchall()

    conn.close()

    return jsonify({
        "item": dict(item),
        "available": [dict(x) for x in available],
        "borrowed": [dict(x) for x in borrowed],
        "other": [dict(x) for x in other]
    })


@app.route('/borrow')
def borrow():

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()

    cursor.execute(""" 
        SELECT ItemId, Category, TRIM(Class) AS Class, Type, COUNT(*) AS Quantity
        FROM Items
        GROUP BY Category, Class, Type
    """)

    items = cursor.fetchall()

    conn.close()

    return render_template('borrow.html', items=items)


@app.route('/')
def home():
    return render_template('login.html')


@app.route('/dashboard')
def dashboard():

    if 'username' not in session:
        return render_template('login.html')

    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    cur.execute("""
        SELECT
            Borrower.BorrowerName,
            Borrower.SchoolID,
            COUNT(Log.LogID) AS TotalBorrowed
        FROM Log
        JOIN Borrower
            ON Log.SchoolID = Borrower.SchoolID
        GROUP BY Borrower.SchoolID
        ORDER BY TotalBorrowed DESC
        LIMIT 10
    """)

    top_borrowers = cur.fetchall()

    cur.execute("""
        SELECT
            Items.Type,
            COUNT(Log.ItemID) AS BorrowCount
        FROM Log
        JOIN Items
            ON Log.ItemID = Items.ItemID
        GROUP BY Items.Type
        ORDER BY BorrowCount DESC
        LIMIT 10
    """)

    top_items = cur.fetchall()

    cursor.execute("""
    SELECT COUNT(*) AS Total
    FROM Borrower
""")
    Borrowers = cursor.fetchone()

    cursor.execute("""
        SELECT COUNT(*) AS Borrowings
        FROM Log
        WHERE DateReturned is NULL
    """)
    Borrowing = cursor.fetchone()

    cursor.execute("""
        SELECT COUNT(*) AS Return
        FROM Log
        WHERE DateReturned IS NOT NULL
    """)
    Returned = cursor.fetchone()

    cursor.execute("""
        SELECT COUNT(*) AS Item
        FROM Items
    """)
    Items = cursor.fetchone()

    
    
    cursor.execute("""
        SELECT COUNT(*) AS Available
        FROM Items WHERE Status = 'AVAILABLE'
    """)

    Available = cursor.fetchone()

    cursor.execute("""
            SELECT COUNT(*) AS BROKEN
            FROM Items WHERE Status = 'BROKEN'
        """)
    
    Broken = cursor.fetchone()


    conn.close()
    

    return render_template('dashboard.html',Broken = Broken,Items=Items,Available = Available , Returned=Returned, Borrower=Borrowers, ss=88, Borrowing = Borrowing, top_borrowers=top_borrowers, top_items=top_items)


@app.route('/documentation')
def documentation():
    return render_template('documentation.html')


@app.route('/analytics')
def analytics():

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    cur.execute("""
        SELECT
            Borrower.BorrowerName,
            Borrower.SchoolID,
            COUNT(Log.LogID) AS TotalBorrowed
        FROM Log
        JOIN Borrower
            ON Log.SchoolID = Borrower.SchoolID
        GROUP BY Borrower.SchoolID
        ORDER BY TotalBorrowed DESC
        LIMIT 10
    """)

    top_borrowers = cur.fetchall()

    cur.execute("""
        SELECT
            Items.Type,
            COUNT(Log.ItemID) AS BorrowCount
        FROM Log
        JOIN Items
            ON Log.ItemID = Items.ItemID
        GROUP BY Items.Type
        ORDER BY BorrowCount DESC
        LIMIT 10
    """)

    top_items = cur.fetchall()

    conn.close()

    return render_template(
        "analytics.html",
        top_borrowers=top_borrowers,
        top_items=top_items
    )


@app.route('/broken')
def broken():
    return render_template('broken.html')


# ============================================================
# ITEMS
# ============================================================

@app.route('/brokenitems')
def getbroken():

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM Items
        WHERE Status = 'BROKEN'
    """)

    rows = cursor.fetchall()

    conn.close()

    data = []

    for row in rows:

        remarks = row[5]

        if remarks is None:
            remarks = ""

        data.append({
            "ItemID": row[0],
            "Code": row[1],
            "Category": row[2],
            "Type": row[3],
            "Status": row[4],
            "Remarks": remarks
        })

    return jsonify(data)


@app.route('/returningItem')
def get_nearest_expiry():

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()

    today = datetime.now().date()

    cursor.execute("""
        SELECT * FROM Items
        WHERE expiry_date >= ?
        ORDER BY expiry_date ASC
        LIMIT 1
    """, (today,))

    item = cursor.fetchone()

    conn.close()

    return item


@app.route('/test')
def test():

    return jsonify({
        "items": [
            {
                "ItemID": 1,
                "Code": "ET006",
                "Type": "Telescope",
                "Status": "Borrowed"
            },
            {
                "ItemID": 2,
                "Code": "ET007",
                "Type": "Laptop",
                "Status": "Available"
            },
            {
                "ItemID": 3,
                "Code": "ET008",
                "Type": "Projector",
                "Status": "Broken"
            }
        ]
    })


@app.route('/items')
def get_items():

    db_conn = sqlite3.connect(DB_PATH)
    cursor = db_conn.cursor()

    cursor.execute("SELECT * FROM Items")

    rows = cursor.fetchall()

    db_conn.close()

    data = []

    for row in rows:

        remarks = row[5]

        if remarks is None:
            remarks = ""

        data.append({
            "ItemID": row[0],
            "Code": row[1],
            "Category": row[2],
            "Type": row[3],
            "Status": row[4],
            "Remarks": remarks
        })

    return jsonify(data)


@app.route('/count')
def count():

    db_conn = sqlite3.connect(DB_PATH)

    type_ = ""

    cursor = db_conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM Items WHERE Type = ?",
        (type_,)
    )

    count = cursor.fetchone()[0] + 1

    db_conn.close()

    return jsonify({
        "count": count
    })


# ============================================================
# QR SCAN
# ============================================================

@app.route('/qrscan', methods=['POST'])
def qr_scan():

    data = request.get_json()
    codes = data.get("codes", [])

    if not codes:
        return jsonify({
            "items": [],
            "missing": []
        })

    placeholder = ','.join('?' * len(codes))

    db_conn = sqlite3.connect(DB_PATH)
    cursor = db_conn.cursor()

    cursor.execute(
        f"SELECT * FROM Items WHERE Code IN ({placeholder})",
        codes
    )

    rows = cursor.fetchall()

    db_conn.close()

    items = []
    found_codes = []

    for row in rows:

        items.append({
            "ItemID": row[0],
            "Code": row[1],
            "Category": row[2],
            "Type": row[3],
            "Status": row[4]
        })

        found_codes.append(row[1])

    missing = [
        code for code in codes
        if code not in found_codes
    ]

    return jsonify({
        "items": items,
        "missing": missing
    })

# ============================================================
# BORROWING
# ============================================================

@app.route('/confirmborrow', methods=['POST'])
def confirm_borrow():

    data = request.get_json()

    name = data.get('name')
    studentid = data.get('studentid')
    email = data.get('email')
    institute = data.get('institute')
    contact = data.get('contact')
    dateB = data.get('dateB')
    dateR = data.get('dateR')
    items = data.get('items')
    approvedBy = data.get('approvedBy')
    remarks = data.get('remarks')

    db_conn = sqlite3.connect(DB_PATH)
    cursor = db_conn.cursor()

    cursor.execute("""
        SELECT * FROM Borrower
        WHERE SchoolID = ?
    """, (studentid,))

    existing = cursor.fetchone()

    if not existing:

        cursor.execute("""
            INSERT INTO Borrower
            (schoolID, BorrowerName, Email, Department, Contact)
            VALUES (?, ?, ?, ?, ?)
        """, (
            studentid,
            name,
            email,
            institute,
            contact
        ))

    # LOOP THROUGH ITEMS
    for item in items:

        # INSERT LOG
        cursor.execute("""
            INSERT INTO Log
            (SchoolID, ItemID, DateBorrowed, ExpectedReturnDate, ApprovedBy, Remarks)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            studentid,
            item['ItemID'],
            dateB,
            dateR,
            approvedBy,
            remarks
        ))

        # UPDATE ITEM STATUS
        cursor.execute("""
            UPDATE Items
            SET Status = ?
            WHERE ItemID = ?
        """, (
            "BORROWED",
            item['ItemID']
        ))

    db_conn.commit()
    db_conn.close()

    return jsonify({
        "success": True,
        "message": "Borrow confirmed"
    })


# ============================================================
# RETURNING
# ============================================================

@app.route('/returning')
def returning():

    is_superAdmin = session.get('role') == 'superAdmin'

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    query = """
    SELECT
        Log.LogID,
        Borrower.SchoolID,
        Borrower.BorrowerName,
        Borrower.Email,
        Borrower.Contact,
        Borrower.Department,
        Log.DateBorrowed,
        Log.ExpectedReturnDate,
        Log.DateReturned,
        Log.ApprovedBy,
        Items.Code,
        Items.Category,
        Items.Type,
        Items.Status
    FROM Log
    INNER JOIN Borrower
        ON Log.SchoolID = Borrower.SchoolID
    INNER JOIN Items
        ON Log.ItemID = Items.ItemID
"""

    cur.execute(query)

    rows = cur.fetchall()

    conn.close()

    grouped = {}

    for row in rows:

        sid = row["LogID"]

        if sid not in grouped:

            grouped[sid] = {
                "LogID": sid,
                "SchoolID": row["SchoolID"],
                "BorrowerName": row["BorrowerName"],
                "Email": row["Email"],
                "Contact": row["Contact"],
                "Department": row["Department"],
                "DateBorrowed": row["DateBorrowed"],
                "ExpectedReturnDate": row["ExpectedReturnDate"],
                "DateReturned": row["DateReturned"],
                "Items": [],
                "ApprovedBy": row["ApprovedBy"]
            }

        grouped[sid]["Items"].append(
            row["Type"]
        )

    return render_template(
        "returning.html",
        data=list(grouped.values()),
        is_superAdmin=is_superAdmin
    )


@app.route('/confirmreturn', methods=['POST'])
def confirm_return():

    data = request.get_json()
    qrcodes = data.get('codes', [])

    if not qrcodes:
        return jsonify({
            "items": []
        })

    placeholder = ','.join('?' * len(qrcodes))

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    query = f"""
        SELECT
            Items.ItemID,
            Items.Code,
            Items.Type,
            Borrower.BorrowerName
        FROM Log

        INNER JOIN Items
            ON Log.ItemID = Items.ItemID

        INNER JOIN Borrower
            ON Log.SchoolID = Borrower.SchoolID

        WHERE Items.Code IN ({placeholder})
        AND Log.DateReturned IS NULL
    """

    cur.execute(query, qrcodes)

    rows = cur.fetchall()

    conn.close()

    data = []

    for row in rows:

        data.append({
            "ItemID": row["ItemID"],
            "Code": row["Code"],
            "Type": row["Type"],
            "BorrowerName": row["BorrowerName"]
        })

    return jsonify({
        "items": data
    })

@app.route('/updatereturn', methods=['POST'])
def update_return():

    data = request.get_json()

    items = data.get('items')

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    for item in items:

        # UPDATE ITEM STATUS
        cur.execute("""
            UPDATE Items
            SET Status = ?
            WHERE ItemID = ?
        """, (
            "AVAILABLE",
            item['ItemID']
        ))

        # UPDATE LOG RETURN DATE
        cur.execute("""
            UPDATE Log
            SET DateReturned = DATE('now')
            WHERE ItemID = ?
            AND DateReturned IS NULL
        """, (
            item['ItemID'],
        ))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Items returned successfully"
    })


@app.route('/manualReturn', methods=['POST'])
def manualReturn():

    data = request.get_json()

    school_id = data['studentId']
    code = data['code']

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # FIND ITEM USING CODE
    cur.execute("""
        SELECT ItemID
        FROM Items
        WHERE Code = ?
    """, (code,))

    item = cur.fetchone()

    if not item:

        conn.close()

        return jsonify({
            "message": "Item code not found."
        })

    item_id = item[0]

    # CHECK ACTIVE BORROW RECORD
    cur.execute("""
        SELECT LogID
        FROM Log
        WHERE SchoolID = ?
        AND ItemID = ?
        AND (DateReturned IS NULL OR DateReturned = '')
    """, (
        school_id,
        item_id
    ))

    log = cur.fetchone()

    if not log:

        conn.close()

        return jsonify({
            "message": "No active borrowing record found."
        })

    today = datetime.now().strftime("%d/%m/%Y")

    # UPDATE LOG
    cur.execute("""
        UPDATE Log
        SET DateReturned = ?
        WHERE LogID = ?
    """, (
        today,
        log[0]
    ))

    # UPDATE ITEM STATUS
    cur.execute("""
        UPDATE Items
        SET Status = 'AVAILABLE'
        WHERE ItemID = ?
    """, (item_id,))

    cur.execute("""
        SELECT Type
        FROM Items
        WHERE ItemID = ?
    """, (item_id,))

    item_name = cur.fetchone()[0]

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Item successfully returned.",
        "item": item_name
    })


# ============================================================
# PHOTOS
# ============================================================

@app.route("/savephotos", methods=["POST"])
def savephotos():

    data = request.get_json()

    images = data["images"]

    folder = BASE_DIR / "static" / "photos" / "borrow"

    os.makedirs(folder, exist_ok=True)

    for i, image in enumerate(images):

        image = image.split(",")[1]

        image_bytes = base64.b64decode(image)

        filename = (
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            f"_{i+1}.jpg"
        )

        with open(folder / filename, "wb") as f:
            f.write(image_bytes)

    return jsonify({
        "message": "Photos saved successfully!"
    })


# ============================================================
# USER MANAGEMENT
# ============================================================

@app.route("/createUser", methods=["POST"])
def createUser():

    data = request.get_json()

    name = data.get("name")
    password = data.get("password")

    if not name or not password:

        return jsonify({
            "success": False,
            "message": "Please fill in all fields."
        })

    hashed_password = generate_password_hash(password)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:

        cur.execute("""
            INSERT INTO Users (Name, Password, Status)
            VALUES (?, ?, ?)
        """, (
            name,
            hashed_password,
            "Admin"
        ))

        conn.commit()

        time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with open("AccountLog.txt", "a") as file:
        
                file.write(
                    f"[{time}] user: {name} was created \n"
                )
        
            

        return jsonify({
            "success": True,
            "message": "User created successfully."
        })

    except sqlite3.Error as e:

        return jsonify({
            "success": False,
            "message": "Error creating user."
        })

    finally:

        conn.close()

##fast borrow
@app.route("/get_student/<student_id>")
def get_student(student_id):

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            SchoolID,
            BorrowerName,
            Email,
            Department,
            Contact
        FROM Borrower
        WHERE SchoolID = ?
        """,
        (student_id,)
    )

    student = cur.fetchone()

    conn.close()

    if student:

        return jsonify({
            "success": True,
            "studentID": student[0],
            "name": student[1],
            "email": student[2],
            "department": student[3],
            "contact": student[4],
            "approvedBy": session.get("username")
        })

    return jsonify({
        "success": False
    })


@app.route("/manageAccount")
def manageAccount():

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        "SELECT UserID, Name, Status FROM Users"
    )

    users = cur.fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "users": [
            {
                "UserID": u[0],
                "Name": u[1],
                "Status": u[2]
            }
            for u in users
        ]
    })


@app.route("/get_user/<int:userID>")
def get_user(userID):

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT UserID, Name, Status
        FROM Users
        WHERE UserID = ?
    """, (userID,))

    user = cur.fetchone()

    conn.close()

    if user:

        return jsonify({
            "success": True,
            "userID": user[0],
            "name": user[1],
            "status": user[2]
        })

    return jsonify({
        "success": False
    })

@app.route("/update_user/<int:userID>", methods=["POST"])
def update_user(userID):

    data = request.get_json()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    if data.get("password"):

        hashed_password = generate_password_hash(data["password"])

        cur.execute(
            """
            UPDATE Users
            SET Name = ?, Password = ?, Status = ?
            WHERE UserID = ?
            """,
            (
                data["name"],
                hashed_password,
                data["status"],
                userID
            )
        )
        time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with open("AccountLog.txt", "a") as file:
        
                file.write(
                    f"[{time}] {data['name']} Account Details Updated\n"
                )

    else:

        cur.execute(
            """
            UPDATE Users
            SET Name = ?, Status = ?
            WHERE UserID = ?
            """,
            (
                data["name"],
                data["status"],
                userID
            )
        )
        time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with open("AccountLog.txt", "a") as file:
                           
             file.write(f"[{time}] {data['name']} Account Details Updated\n")

    conn.commit()
    conn.close()

    return jsonify({
        "success": True
    })


# Delete User

@app.route("/deleteUser/<int:userID>", methods=["POST"])
def deleteUser(userID):

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Get the user's name before deleting
    cur.execute("""
        SELECT Name
        FROM Users
        WHERE UserID = ?
    """, (userID,))

    user = cur.fetchone()

    if not user:

        conn.close()

        return jsonify({
            "success": False,
            "message": "User not found"
        })

    username = user[0]

    # Delete user
    cur.execute("""
        DELETE FROM Users
        WHERE UserID = ?
    """, (userID,))

    conn.commit()
    conn.close()

    # Write deletion to log
    time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open("AccountLog.txt", "a") as file:

        file.write(
            f"[{time}] UserID {userID} ({username}) was deleted\n"
        )

    return jsonify({
        "success": True,
        "message": "User successfully deleted"
    })


# ============================================================
# RUN APP
# ============================================================

if __name__ == '__main__':
    app.run(
        debug=True,
        use_reloader=False
    )

