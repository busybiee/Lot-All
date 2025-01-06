const CLIENT_ID = '<YOUR_CLIENT_ID>';
const API_KEY = '<YOUR_API_KEY>';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

const GAMES = {
  "twoStep": { range: 35, bonusRange: 35, numbersToPick: 4, bonusName: "Bonus Ball" },
  "texasLotto": { range: 54, bonusRange: 0, numbersToPick: 6, bonusName: "" },
  "megaMillions": { range: 70, bonusRange: 25, numbersToPick: 5, bonusName: "Mega Ball" },
};

let currentGame = null;

// Initialize lottery selection buttons
document.getElementById("twoStepBtn").addEventListener("click", () => setupGame("twoStep", "Two Step"));
document.getElementById("texasLottoBtn").addEventListener("click", () => setupGame("texasLotto", "Texas Lotto"));
document.getElementById("megaMillionsBtn").addEventListener("click", () => setupGame("megaMillions", "Mega Millions"));
document.getElementById("backBtn").addEventListener("click", goToMainMenu);

document.getElementById("localFileBtn").addEventListener("click", () => {
  document.getElementById("csvInput").click();
});
document.getElementById("csvInput").addEventListener("change", processLocalCSV);

document.getElementById("authorizeBtn").addEventListener("click", handleAuthClick);

// Initialize Google API
gapi.load('client:auth2', initClient);

function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: SCOPES,
  }).then(() => console.log("Google API client initialized"));
}

function setupGame(gameKey, gameName) {
  currentGame = GAMES[gameKey];
  document.getElementById("gameName").textContent = gameName;
  document.getElementById("app").style.display = "none";
  document.getElementById("lotteryScreen").style.display = "block";
}

function goToMainMenu() {
  document.getElementById("lotteryScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("result").innerHTML = "";
  currentGame = null;
}

function handleAuthClick() {
  gapi.auth2.getAuthInstance().signIn().then(listDriveFiles);
}

function listDriveFiles() {
  gapi.client.drive.files.list({
    pageSize: 10,
    fields: 'files(id, name)',
    q: "mimeType='text/csv'",
  }).then(response => {
    const files = response.result.files;
    if (files.length) {
      const options = files.map(file => `<option value="${file.id}">${file.name}</option>`).join('');
      document.getElementById("result").innerHTML = `
        <p>Select a file:</p>
        <select id="fileSelector">${options}</select>
        <button id="processDriveFileBtn">Process File</button>`;
      document.getElementById("processDriveFileBtn").addEventListener("click", processDriveFile);
    } else {
      alert("No CSV files found in your Google Drive.");
    }
  });
}

function processDriveFile() {
  const fileId = document.getElementById("fileSelector").value;
  gapi.client.drive.files.get({ fileId, alt: 'media' }).then(response => {
    processCSVData(response.body);
  });
}

function processLocalCSV() {
  const file = document.getElementById("csvInput").files[0];
  if (!file) {
    alert("No file selected!");
    return;
  }

  const reader = new FileReader();
  reader.onload = e => processCSVData(e.target.result);
  reader.readAsText(file);
}

function processCSVData(csvData) {
  const rows = csvData.split("\n").slice(1);
  if (!rows.length) {
    document.getElementById("result").textContent = "CSV file is empty.";
    return;
  }

  const data = { numbers: [], bonus: [], latestDate: "" };
  let latestTimestamp = 0;

  rows.forEach(row => {
    const cols = row.split(",");
    const numCols = cols.slice(4, 4 + currentGame.numbersToPick).map(Number);
    const bonusCol = currentGame.bonusRange > 0 ? Number(cols[4 + currentGame.numbersToPick]) : null;
    const date = new Date(cols[3], cols[1] - 1, cols[2]).getTime();

    data.numbers.push(...numCols);
    if (bonusCol) data.bonus.push(bonusCol);
    if (date > latestTimestamp) latestTimestamp = date;
  });

  const numberProbs = calculateProbabilities(data.numbers, currentGame.range);
  const bonusProbs = currentGame.bonusRange > 0 ? calculateProbabilities(data.bonus, currentGame.bonusRange) : [];
  const predictedNumbers = getMostFrequent(data.numbers, currentGame.numbersToPick);
  const predictedBonus = currentGame.bonusRange > 0 ? getMostFrequent(data.bonus, 1) : [];

  const lastDate = new Date(latestTimestamp);
  const formattedDate = `${lastDate.getMonth() + 1}/${lastDate.getDate()}/${lastDate.getFullYear()}`;

  document.getElementById("result").innerHTML = `
    <p style="color: red; font-size: 0.9rem;">Latest Drawing Date: ${formattedDate}</p>
    <p><strong>Predicted Numbers for the Next Drawing:</strong></p>
    <p>Numbers: ${predictedNumbers.join(", ")}</p>
    ${predictedBonus.length ? `<p>${currentGame.bonusName}: ${predictedBonus.join(", ")}</p>` : ""}
    <p style="font-size: 0.8rem;"><strong>Probability Distribution:</strong></p>
    <p style="font-size: 0.8rem;"><u>Main Numbers:</u> ${formatProbabilities(numberProbs)}</p>
    ${
      currentGame.bonusRange > 0
        ? `<p style="font-size: 0.8rem;"><u>${currentGame.bonusName}:</u> ${formatProbabilities(bonusProbs)}</p>`
        : ""
    }
  `;
}

function calculateProbabilities(arr, range) {
  const total = arr.length;
  const frequency = Array(range + 1).fill(0);

  arr.forEach(num => {
    if (num >= 1 && num <= range) {
      frequency[num]++;
    }
  });

  return frequency.map(count => ((count / total) * 100).toFixed(2));
}

function getMostFrequent(arr, count) {
  const frequency = {};
  arr.forEach(num => {
    frequency[num] = (frequency[num] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([num]) => Number(num));
}

function formatProbabilities(probabilities) {
  return probabilities
    .map((prob, index) => `${index}: ${prob}%`)
    .filter(entry => !entry.startsWith("0: 0.00%"))
    .join("; ");
}
