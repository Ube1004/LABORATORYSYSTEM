//global variable
let overlayTimer;
let borrowData = {};
let returningItems = [];
let codes = [];
let scanner;
let scannedItems = [];
let returnCodes = [];
let returnScanner;
let returnItems = [];
const promise = new Promise((resolve, reject) => {
  resolve("Done!");
});

// NOTE: Jinja ({{ }}) is NOT processed in static .js files, so this will be the
// literal text "{{ session['name'] }}". Set it in the HTML template instead, e.g.
// <script>const curruser = {{ session['name']|tojson }};</script>
const curruser = "{{ session['name'] }}";


/* =========================================
   LOGIN / NAVIGATION
   ========================================= */

function login() {
  let username = document.getElementById("username").value;
  let password = document.getElementById("password").value;

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert("Login Success");
        window.location.href = "/dashboard";
      } else {
        alert("Invalid credentials");
      }
    });
}

// Only try to log in when the login fields actually exist on this page
document.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && document.getElementById("username")) {
    login();
  }
});

function gotologin() {
  window.location.href = "/gotologin";
}

function logout() {
  window.location.href = "/logout";
}

function returning() {
  window.location.href = "/returning";
}

function modifyRecord(id) {
  window.location.href = "/modify/" + id;
}

function qrscan() {
  fetch("/qrscan");
}


/* =========================================
   BORROWING: MANUAL ADD
   ========================================= */

function manualAdd() {
  let code = prompt("Enter the item code:");

  if (code === null) return;

  code = code.trim();

  if (!code) {
    alert("Please enter an item code.");
    return;
  }

  if (codes.includes(code)) {
    alert("This item has already been added.");
    return;
  }

  codes.push(code);

  loadBorrowItems();
}


/* =========================================
   BORROWING: QR SCAN
   ========================================= */
function renderScannedList() {
  const list = document.getElementById("scannedList");
  if (!list) return;

  list.innerHTML = "";

  codes.forEach((code) => {
    const li = document.createElement("li");
    li.textContent = code;
    list.appendChild(li);
  });
}

// Label shown on top of the camera view
function showScanOverlay(text, isDuplicate = false) {
  const overlay = document.getElementById("scanOverlay");
  if (!overlay) return;

  overlay.textContent = text;
  overlay.classList.toggle("duplicate", isDuplicate);
  overlay.classList.add("show");

  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => overlay.classList.remove("show"), 1500);
}

// Called every time the camera decodes a QR code
function onScanSuccess(decodedText) {
  const code = decodedText.trim();
  if (!code) return;

  const feedback = document.getElementById("scanFeedback");
  const reader = document.getElementById("reader");

  if (codes.includes(code)) {
    if (feedback) feedback.textContent = `Already scanned: ${code}`;
    showScanOverlay(`Already scanned: ${code}`, true);
    return;
  }

  codes.push(code);
  console.log("CODES:", codes);

  if (feedback) feedback.textContent = `✔ Scanned: ${code}`;
  showScanOverlay(`✔ ${code}`);
  renderScannedList();

  // Flash the camera border green
  if (reader) {
    reader.classList.add("scan-hit");
    setTimeout(() => reader.classList.remove("scan-hit"), 400);
  }

  // Vibrate on phones that support it
  if (navigator.vibrate) navigator.vibrate(100);
}

async function startScanner() {
  if (scanner) return; // Prevent opening multiple scanners

  openForm("cameraForm");

  // Show anything already added (scanned earlier or via Manual Add)
  const feedback = document.getElementById("scanFeedback");
  if (feedback) feedback.textContent = "";
  renderScannedList();

  scanner = new Html5Qrcode("reader");

  try {
    
await scanner.start(
  { facingMode: "environment" },
  {
    fps: 10,
    qrbox: (viewfinderWidth, viewfinderHeight) => {
      const size = Math.min(
        viewfinderWidth,
        viewfinderHeight,
        300
      );

      return {
        width: size,
        height: size
      };
    }
  },
  onScanSuccess,
  () => {}
);


    console.log("Scanner started");
  } catch (error) {
    console.error("Camera error:", error);
    scanner = null;
    closeForm("cameraForm");
    alert("Could not start the camera.");
  }
}
async function stopScanner(afterStop) {
  if (scanner) {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
      scanner = null;

      console.log("Scanner stopped");
    } catch (error) {
      console.error("Error stopping scanner:", error);
    }
  }

  closeForm("cameraForm");

  // Process scanned items only if there are codes
  if (codes.length > 0 && typeof afterStop === "function") {
    afterStop(codes);
  }
}

function loadBorrowItems() {
  let studentid = document.getElementById("StudentID").value.trim();
  let name = document.getElementById("Name").value.trim();
  let email = document.getElementById("Email").value.trim();
  let institute = document.getElementById("Institute").value.trim();
  let contact = document.getElementById("Contact").value.trim();
  let dateB = document.getElementById("dateBorrowed").value;
  let dateR = document.getElementById("dateReturn").value;
  let approvedBy = document.getElementById("approvedBy").value.trim();
  let remarks = document.getElementById("remarks").value.trim();

  if (!studentid || !name || !email || !institute || !contact || !approvedBy) {
    document.getElementById("mydiv").showPopover();
    return;
  }

  fetch("/qrscan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ codes: codes }),
  })
    .then((res) => res.json())
    .then((data) => {
      const itemBox = document.getElementById("itemBox");
      itemBox.innerHTML = "";

      data.items.forEach((item) => {
        const div = document.createElement("div");
        div.classList.add("item");
        div.textContent = `${item.Type} with code ${item.Code}`;
        itemBox.appendChild(div);
      });

      borrowData = {
        name,
        studentid,
        email,
        institute,
        contact,
        dateB,
        dateR,
        items: data.items,
        approvedBy,
        remarks,
      };

      document.getElementById("confirmBtn").style.display = "block";

      if (data.missing?.length) {
        alert("Missing/Not on Database: " + data.missing.join(", "));
      }
    })
    .catch((error) => {
      console.error("Error loading items:", error);
      alert("Failed to load item details.");
    });
}

function qrscanform(codes) {
  loadBorrowItems();
}

function confirmborrow(borrowData) {
  if (!borrowData) {
    alert("Must insert data first");
    return;
  }

  if (
    !borrowData.studentid ||
    !borrowData.name ||
    !borrowData.email ||
    !borrowData.institute ||
    !borrowData.contact ||
    !borrowData.approvedBy
  ) {
    document.getElementById("mydiv").showPopover();
    return;
  }

  fetch("/confirmborrow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(borrowData),
  })
    .then(async (res) => {
      const text = await res.text();

      console.log("Confirm borrow status:", res.status);
      console.log("Confirm borrow response:", text);

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "Flask returned HTML instead of JSON. Check the Python terminal.",
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Borrowing failed");
      }

      return data;
    })
    .then((data) => {
      console.log(data);
      alert("Data successfully inserted");
      returning();
    })
    .catch((error) => {
      console.error("Confirm borrow error:", error);
      alert(error.message);
    });
}

function test() {
  let studentid = document.getElementById("StudentID").value;
  let name = document.getElementById("Name").value;
  let email = document.getElementById("Email").value;
  let institute = document.getElementById("Institute").value;
  let contact = document.getElementById("Contact").value;
  let dateB = document.getElementById("dateBorrowed").value;
  let dateR = document.getElementById("dateReturn").value;
  fetch("/test")
    .then((res) => res.json())
    .then((data) => {
      alert(
        JSON.stringify(data) +
          studentid +
          name +
          email +
          institute +
          contact +
          dateB +
          dateR,
      );
      showCButton();
    });
}

function showCButton() {
  document.getElementById("confirmBtn").style.display = "block";
}

function test1() {
  alert("Hello world");
}

//variable for borrowing
function borrowform() {
  let name = document.getElementById("Name").value;
  let email = document.getElementById("Email").value;
  let StudentID = document.getElementById("StudentID").value;
  let Institute = document.getElementById("Institute").value;
  let Conctact = document.getElementById("Contact").value;
  let dateB = document.getElementById("dateBorrowed").value;
  let dateR = document.getElementById("dateReturn").value;
  let timeB = document.getElementById("dateTimeBorrowed").value;
  let timeR = document.getElementById("dateTimeReturn").value;

  if (
    !name ||
    !email ||
    !StudentID ||
    !timeB ||
    !timeR ||
    !Institute ||
    !Conctact ||
    !dateB ||
    !dateR
  ) {
    alert("Please fill in all fields.");
    return;
  }
}

function borrowin() {
  let name = "";
}


/* =========================================
   MODALS
   ========================================= */

function closeForm(formId) {
  document.getElementById(formId).style.display = "none";
}

function openForm(formId, itemId) {
  document.getElementById(formId).style.display = "block";

  if (itemId) {
    fetch("/getItem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: itemId }),
    })
      .then((res) => res.json())
      .then((data) => {
        document.getElementById("Type").textContent = data.item.Type;
        document.getElementById("Category").textContent = data.item.Category;
        document.getElementById("Class").textContent = data.item.Class;
        let codes = "";
        let Bcodes = "";

        data.available.forEach((item) => {
          codes += item.Code + ", ";
        });

        document.getElementById("AvailableCodes").innerHTML = codes;

        data.borrowed.forEach((item) => {
          Bcodes += item.Code + ", ";
        });

        document.getElementById("BorrowedCodes").innerHTML = Bcodes;

        document.getElementById(formId).style.display = "block";
      });
  }
}

/* DEFAULT BORROW FORM DATES (borrowed = today, return = +7 days) */
document.addEventListener("DOMContentLoaded", function () {
  let now = new Date();
  let today = now.toISOString().split("T")[0];
  let returnDateObj = new Date(today);
  let currentTime = now.toTimeString().slice(0, 5);

  returnDateObj.setDate(returnDateObj.getDate() + 7);

  let dateBorrowed = document.getElementById("dateBorrowed");
  let dateReturn = document.getElementById("dateReturn");
  let dateTimeBorrowed = document.getElementById("dateTimeBorrowed");

  if (dateBorrowed) {
    dateBorrowed.value = today;
  }

  if (dateReturn) {
    dateReturn.value = returnDateObj.toISOString().split("T")[0];
  }

  if (dateTimeBorrowed) {
    dateTimeBorrowed.value = currentTime;
  }
});

function qrmaker() {
  fetch("/qrmaker", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category: category, type: type }),
  });
}


/* =========================================
   RETURNING
   ========================================= */

function ItemReturning(items) {
  let html = "";

  items.forEach((item) => {
    html += `
            <div class="item">
                ${item.Type} borrowed by ${item.BorrowerName}
            </div>
        `;
  });

  document.getElementById("itemBox").innerHTML = html;
}

function manualReturn() {
  let studentId = document.getElementById("studentId").value;
  let code = document.getElementById("code").value;

  fetch("/manualReturn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId: studentId,
      code: code,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);

      if (data.item) {
        document.getElementById("itemBox").innerHTML = `<p>${data.item}</p>`;
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Request failed.");
    });
}

function startReturnScanner() {
  returnScanner = new Html5Qrcode("returnReader");

  returnScanner
    .start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250,
      },
      (decodedText) => {
        console.log("RETURN QR:", decodedText);

        if (!returnCodes.includes(decodedText)) {
          returnCodes.push(decodedText);

          console.log("RETURN CODES:", returnCodes);
        }
      },
      (errorMessage) => {
        // Ignore failed scans
      },
    )
    .catch((error) => {
      console.log("Camera error:", error);
    });
}

function stopReturnScanner() {
  if (returnCodes.length === 0) {
    alert("Please scan at least one item first.");
    return;
  }

  if (returnScanner) {
    returnScanner
      .stop()
      .then(() => {
        returnScanner.clear();
        returnScanner = null;

        console.log("Return scanner stopped");

        confirmreturn();
      })
      .catch((error) => {
        console.log("Error stopping scanner:", error);
      });
  } else {
    confirmreturn();
  }
}

function updateReturn() {
  console.log("SENDING RETURN:", returnItems);

  fetch("/updatereturn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: returnItems,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);

      alert(data.message);
      location.reload();
    });
}

function confirmreturn() {
  fetch("/confirmreturn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      codes: returnCodes,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("RETURN ITEMS:", data.items);

      returnItems = data.items;

      let html = "";

      data.items.forEach((item) => {
        html += `
                <div class="item">
                    ${item.Type} with code ${item.Code}
                    <br>
                    Borrowed by: ${item.BorrowerName}
                </div>
            `;
      });

      document.getElementById("returnItemBox").innerHTML = html;
    });
}

//item box for borrowing
function loadItems() {
  fetch("/items")
    .then((res) => res.json())
    .then((data) => {
      let html = "";

      data.items.forEach((item) => {
        html += `
        <div class="item">
           ${item.Type} with code ${item.Code}
        </div>
    `;
      });
    });
}


/* =========================================
   CAMERA (PHOTOS)
   ========================================= */

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");
const photoModal = document.getElementById("photoModal");

let photos = [];
let imageData = "";

/* OPEN CAMERA */
if (video && canvas && preview && photoModal) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
      })
      .then((stream) => {
        video.srcObject = stream;
      })
      .catch((error) => {
        console.error("Camera error:", error);

        if (error.name === "NotAllowedError") {
          alert(
            "Camera access was denied. Please allow camera access in your browser settings.",
          );
        } else if (error.name === "NotFoundError") {
          alert("No camera was found on this device.");
        } else if (error.name === "NotReadableError") {
          alert("The camera is already being used by another application.");
        } else {
          alert("Unable to access the camera.");
        }
      });
  } else {
    alert("Camera is not supported by this browser.");
  }
}

/* TAKE PHOTO */
function takePhoto() {
  if (!video || !canvas || !preview || !photoModal) {
    return;
  }

  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const image = canvas.toDataURL("image/jpeg");

  /* Save photo */
  photos.push(image);

  /* Show the captured photo in the center */
  preview.src = image;

  photoModal.style.display = "flex";
}

/* REMOVE PHOTO */
function removePhoto() {
  /* Remove the most recent photo */
  photos.pop();

  /* Clear preview */
  preview.src = "";

  /* Close popup */
  photoModal.style.display = "none";
}

/* CONFIRM PHOTO */
function confirmPhoto() {
  if (photos.length === 0) {
    alert("Please take a photo first.");
    return;
  }

  fetch("/savephotos", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      images: photos,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);

      /* Close popup */
      photoModal.style.display = "none";

      /* Clear preview */
      preview.src = "";

      /* Clear photos after successful save */
      photos = [];
    })
    .catch((error) => {
      console.error("Upload error:", error);

      alert("An error occurred while saving the photo.");
    });
}

/* CLOSE PHOTO MODAL */
function closePhotoModal() {
  photoModal.style.display = "none";
}


/* =========================================
   ACCOUNTS
   ========================================= */

function confirmCreate() {
  let name = document.getElementById("createName").value;
  let password = document.getElementById("createPassword").value;

  if (!name || !password) {
    alert("Please fill in all fields.");
    return;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  if (!/[A-Z]/.test(password)) {
    alert("Password must contain a capital letter.");
    return;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    alert("Password must contain a special character.");
    return;
  }
  fetch("/createUser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, password }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert("User created successfully");
        window.location.href = "/dashboard";
      }
    });
}

function checkID() {
  let studentID = document.getElementById("studentID").value;

  if (studentID === "") {
    alert("Please enter Student ID.");
    return;
  }

  fetch(`/get_student/${studentID}`)
    .then((response) => response.json())
    .then((data) => {
      document.getElementById("checkID").style.display = "none";
      document.getElementById("borrowForm").style.display = "block";

      document.getElementById("StudentID").value = studentID;

      if (data.success) {
        document.getElementById("studentID").value = data.studentID;
        document.getElementById("Name").value = data.name;
        document.getElementById("Email").value = data.email;
        document.getElementById("Institute").value = data.department;
        document.getElementById("Contact").value = data.contact;
        document.getElementById("approvedBy").value = data.approvedBy;
      } else {
        document.getElementById("Name").value = "";
        document.getElementById("Email").value = "";
        document.getElementById("Institute").value = "";
        document.getElementById("Contact").value = "";
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

//manage account
function manageAccount() {
  fetch("/manageAccount")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        alert("Failed to load accounts.");
        return;
      }

      const tbody = document.getElementById("accountTableBody");
      tbody.innerHTML = "";

      data.users.forEach((user) => {
        const row = document.createElement("tr");
        row.innerHTML = `
                    <td>${user.UserID}</td>
                    <td>${user.Name}</td>
                    <td>${user.Status}</td>
                    <td><button onclick="openUserDetails('${user.UserID}')">Manage</button></td>
                `;
        tbody.appendChild(row);
      });

      openForm("manageAccount");
    })
    .catch((error) => console.error(error));
}

function openUserDetails(userID) {
  fetch(`/get_user/${userID}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("userID").value = data.userID;
        document.getElementById("userName").value = data.name;
        document.getElementById("userStatus").value = data.status;

        openForm("manageUserDetails");
      } else {
        alert("User not found.");
      }
    })
    .catch((error) => console.error(error));
}

function saveUserChanges() {
  const payload = {
    userID: document.getElementById("userID").value,
    name: document.getElementById("userName").value,
    password: document.getElementById("userPassword").value,
    status: document.getElementById("userStatus").value,
  };

  const password = payload.password;

  // Validate only when a new password was typed (empty = keep current)
  if (password) {
    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      alert("Password must contain a capital letter.");
      return;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      alert("Password must contain a special character.");
      return;
    }
  }

  // FIX: this request used to live in the `else` branch, so changing a
  // password never saved. It now runs in both cases.
  fetch(`/update_user/${payload.userID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("User updated.");
        closeForm("manageUserDetails");
        manageAccount();
      } else {
        alert("Update failed.");
      }
    })
    .catch((error) => console.error(error));
}

function deleteUser() {
  let userID = document.getElementById("userID").value;

  let confirmation = confirm("Are you sure you want to delete this user?");

  if (!confirmation) {
    return;
  }

  fetch(`/deleteUser/${userID}`, {
    method: "POST",
  })
    .then((res) => res.json())
    .then((data) => {
      alert(data.message);

      if (data.success) {
        location.reload();
      }
    })
    .catch((error) => {
      console.log(error);
    });
}


/* =========================================================
   LABORATORY INVENTORY SEARCH
   ========================================================= */

function searchInventory() {
  const searchInput = document
    .getElementById("inventorySearch")
    .value.toLowerCase()
    .trim();

  const categories = document.querySelectorAll(".inventory-category");

  let totalMatches = 0;

  categories.forEach(function (category) {
    const rows = category.querySelectorAll(".inventory-table tbody tr");

    /*
     * Match the search term against the category header too
     * (e.g. "Toxic Chemicals"). Emoji/symbols are stripped first.
     */
    const headerElement = category.querySelector(".category-header h3");

    const categoryName = headerElement
      ? headerElement.textContent
          .replace(/[^\p{L}\p{N}\s]/gu, "")
          .toLowerCase()
          .trim()
      : "";

    const categoryHeaderMatches =
      searchInput !== "" && categoryName.includes(searchInput);

    let categoryMatches = 0;

    rows.forEach(function (row) {
      const itemName = row
        .querySelector("td:first-child")
        .textContent.toLowerCase()
        .trim();

      if (itemName.includes(searchInput) || categoryHeaderMatches) {
        row.style.display = "";
        categoryMatches++;
        totalMatches++;
      } else {
        row.style.display = "none";
      }
    });

    category.style.display = categoryMatches === 0 ? "none" : "";

    const countElement = category.querySelector(".category-visible-count");

    if (countElement) {
      countElement.textContent = categoryMatches;
    }
  });

  const noResult = document.getElementById("noInventoryResult");
  const searchResult = document.getElementById("searchResult");

  /* EMPTY SEARCH: reset everything */
  if (searchInput === "") {
    categories.forEach(function (category) {
      category.style.display = "";

      const rows = category.querySelectorAll(".inventory-table tbody tr");

      rows.forEach(function (row) {
        row.style.display = "";
      });

      const countElement = category.querySelector(".category-visible-count");

      if (countElement) {
        countElement.textContent = rows.length;
      }
    });

    searchResult.innerHTML = "Showing all laboratory inventory items.";
    noResult.style.display = "none";

    return;
  }

  /* DISPLAY SEARCH RESULTS */
  if (totalMatches > 0) {
    searchResult.innerHTML =
      "Found <strong>" +
      totalMatches +
      "</strong> matching item" +
      (totalMatches !== 1 ? "s" : "") +
      ".";

    noResult.style.display = "none";
  } else {
    searchResult.innerHTML =
      'No inventory items match <strong>"' + searchInput + '"</strong>.';

    noResult.style.display = "block";
  }
}


/* =========================================================
   SEARCH FOR LOG
   Works with the new paginated table (#returnTableMain) and
   falls back to the old table (#returnTable) if that's what
   the page has.
   ========================================================= */

function searchLog() {
  const input = document.getElementById("logSearch");
  if (!input) return;

  const search = input.value.toLowerCase().trim();
  const mainTable = document.getElementById("returnTableMain");

  if (mainTable) {
    if (search === "") {
      // Restore the "first N rows only" view and the See All button
      hideExtraRows("returnTableMain", "seeAllRtrnBtn", 10);
      return;
    }

    mainTable.querySelectorAll("tbody tr.data-row").forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(search);
    });
    return;
  }

  // Legacy table
  document.querySelectorAll("#returnTable tr").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(search)
      ? ""
      : "none";
  });
}


/* MASK EMAIL */
function maskEmail(email) {
  let newemail;
  let last = email.slice(email.indexOf("@") - 1);
  let middle = "*".repeat(email.slice(1, email.indexOf("@") - 1).length);
  let first = email.slice(0, 1);
  return (newemail = first + middle + last);
}


/* =========================================================
   ADD INPUT (dynamic item fields)
   ========================================================= */

function addInput(divID, type, name, id, placeholder, thenWhere) {
  const container = document.getElementById(divID);

  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.id = id + (container.querySelectorAll("input").length + 1);
  input.style.width = "80px";
  input.placeholder =
    placeholder + (container.querySelectorAll("input").length + 1);

  container.appendChild(input);
  container.appendChild(document.createElement("br"));
  if (thenWhere) {
    thenWhere();
  }
}


/* =========================================================
   HIDDEN ROWS ("See All" / "See Less")
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  hideExtraRows("returnTableMain", "seeAllRtrnBtn", 10);
  hideExtraRows("tableReservation", "seeAllBtn", 5);
});

function hideExtraRows(tableId, buttonId, limit = 5) {
  const table = document.getElementById(tableId);
  const button = document.getElementById(buttonId);

  if (!table || !button) {
    return;
  }

  const rows = table.querySelectorAll("tbody tr.data-row");

  rows.forEach((row, index) => {
    row.hidden = index >= limit;
  });

  button.hidden = false;
  button.style.display = "inline-block";
  button.textContent = "See All";
}

function seeAll(tableId, buttonId, limit = 5) {
  const table = document.getElementById(tableId);
  const button = document.getElementById(buttonId);

  if (!table || !button) return;

  const rows = table.querySelectorAll("tbody tr.data-row");
  const showingAll = button.textContent.trim() === "See All";

  rows.forEach((row, index) => {
    row.hidden = !showingAll && index >= limit;
  });

  button.textContent = showingAll ? "See Less" : "See All";
}


/* =========================================================
   RESERVATION
   ========================================================= */

const reservationForm = document.querySelector("#reservationForm form");

// Guard: this script is shared by pages that don't have the reservation form
if (reservationForm) {
  reservationForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const form = this;

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
      });

      if (response.ok) {
        showReservationSummary(form);
      } else {
        const message = await response.text();
        alert(message || "Failed to save reservation.");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong. Please try again.");
    }
  });
}

function showReservationSummary(form) {
  const data = new FormData(form);

  const fields = {
    sumSchoolID: data.get("SchoolID"),
    sumDateFiled: data.get("dateFiled"),
    sumActivity: data.get("activity"),
    sumObjective: data.get("objective"),
    sumDateOfUse: data.get("dateOfUse"),
    sumTime: data.get("time"),
    sumYearSection: data.get("yearAndSection"),
    sumStudents: data.get("numberOfStudent"),
    sumTeacher: data.get("teacher"),
    sumApprovedBy: data.get("ApprovedBy"),
  };

  for (const [id, value] of Object.entries(fields)) {
    document.getElementById(id).textContent = value || "-";
  }

  const items = data.getAll("item[]").filter((item) => item.trim());

  document.getElementById("sumItems").textContent = items.join(", ") || "-";

  closeForm("reservationForm");
  document.getElementById("reservationSummary").style.display = "block";
}

function printSummary() {
  const printable = document.getElementById("printableReservation");

  if (!printable) {
    alert("Reservation summary not found.");
    return;
  }

  // Open a separate window without the website's layout
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Please allow pop-ups to print the reservation.");
    return;
  }

  printWindow.document.open();

  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reservation Form</title>

            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    color: black;
                    margin: 0;
                    width: 100%;
                }

                .form-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .form-header img {
                    width: 75px;
                    height: auto;
                    object-fit: contain;
                }

                h2, h3, h4 {
                    margin: 5px 0;
                }

                p {
                    margin: 12px 0;
                    overflow-wrap: anywhere;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    margin: 16px 0;
                }

                th, td {
                    border: 1px solid black;
                    padding: 8px;
                    text-align: left;
                    overflow-wrap: anywhere;
                    vertical-align: top;
                }

                th {
                    font-weight: bold;
                }

                #sumItems {
                    white-space: pre-wrap;
                }
            </style>
        </head>

        <body>
            ${printable.innerHTML}
        </body>
        </html>
    `);

  printWindow.document.close();

  // Wait for the logo and other resources before printing
  printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
  };
}

// end of reservation