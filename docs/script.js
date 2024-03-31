// Event listener for the file input change
document.getElementById("fileInput").addEventListener("change", function (event) {
  readAndProcessFile(event.target.files[0]);
});

// // Detects if the user has set their system to use dark mode
// const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
// if (prefersDarkMode) {
//   // change bg variable
//   document.documentElement.style.setProperty("--bg-color", "#333");
//   document.documentElement.style.setProperty("--text-color", "#fff");
//   document.querySelector("body > main > section.collapsible-section.my-8.rounded-lg > div.collapsible-content.bg-white.overflow-hidden.rounded-lg > p").setProperty("--text-color", "#fff");
// }

// Configure the drop zone
const dropZone = document.getElementById("dropZone");
dropZone.addEventListener("dragover", function (event) {
  event.stopPropagation();
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy"; // Show as a copy action
});

dropZone.addEventListener("drop", function (event) {
  event.stopPropagation();
  event.preventDefault();
  const files = event.dataTransfer.files; // FileList object.
  readAndProcessFile(files[0]);
});

// Allow click on the drop zone to select file
dropZone.addEventListener("click", function () {
  document.getElementById("fileInput").click();
});

function readAndProcessFile(file) {
  const fileReader = new FileReader();
  fileReader.onload = function (fileLoadedEvent) {
    const text = fileLoadedEvent.target.result;
    processData(text, true); // True indicates this is the initial load
  };
  fileReader.readAsText(file, "UTF-8");
}

// Function to apply filters automatically without a dedicated button
function applyFiltersAutomatically() {
  const fileInput = document.getElementById("fileInput");
  if (fileInput.files.length > 0) {
    const fileReader = new FileReader();
    fileReader.onload = function (fileLoadedEvent) {
      const text = fileLoadedEvent.target.result;
      processData(text, false); // False for subsequent loads
    };
    fileReader.readAsText(fileInput.files[0], "UTF-8");
  }
}

// Attach event listeners to filter inputs for automatic reprocessing
document.getElementById("startDate").addEventListener("change", applyFiltersAutomatically);
document.getElementById("endDate").addEventListener("change", applyFiltersAutomatically);
document.querySelectorAll("#dayFilters label input").forEach((input) => input.addEventListener("change", applyFiltersAutomatically));
document.getElementById("yearSelection").addEventListener("change", applyFiltersAutomatically);

function processData(csvData, isInitialLoad) {
  const lines = csvData.split("\n");
  const headerLines = lines.slice(0, 12); // Extract the first 12 lines for header details
  const dataLines = lines.slice(12); // Data lines excluding headers

  let sumKwh = 0;
  let startDate = null;
  let endDate = null;

  dataLines.forEach((line) => {
    const parts = line.split(",").map((part) => part.trim().replace(/"/g, ""));
    if (parts.length > 2) {
      const date = parts[0];
      const kwh = parseFloat(parts[2]);
      if (!startDate) startDate = date;
      endDate = date;
      if (!isNaN(kwh)) sumKwh += kwh;
    }
  });

  // Call displayCsvDetails with all the parameters, including the newly calculated ones
  displayCsvDetails(headerLines, startDate, endDate, sumKwh);

  let hourlyData = {};
  let hourlyDataPerDay = {}; // New object to store hourly data per day
  let dates = [];
  dataLines.forEach((line) => {
    const [date, time, value] = line.split(",").map((part) => part.replace(/"/g, ""));
    if (!date || !time || !value) return; // Skip incomplete lines

    // Split the date string into components
    const [day, month, year] = date.split("/").map(Number); // Convert each part to a number

    // Create a new Date object using the year, month, and day
    // Note: Months are 0-indexed in JavaScript's Date, so subtract 1 from the month
    const currentDate = new Date(year, month - 1, day);
    dates.push(currentDate); // Collect all dates for initial load processing

    let startDateFilter = document.getElementById("startDate").valueAsDate;
    if (startDateFilter) {
      startDateFilter.setHours(0, 0, 0, 0);
    }

    let endDateFilter = document.getElementById("endDate").valueAsDate;
    if (endDateFilter) {
      endDateFilter.setHours(23, 59, 59, 999);
    }

    const dayFilters = [...document.querySelectorAll('#dayFilters input[type="checkbox"]:checked')].map((el) => parseInt(el.value));
    if (startDateFilter && currentDate < startDateFilter) {
      return;
    }
    if (endDateFilter && currentDate > endDateFilter) {
      return; // Skip this entry if it doesn't match the end date filter
    }
    if (!dayFilters.includes(currentDate.getDay())) {
      return; // Skip this entry if it doesn't match the selected days filter
    }

    const hour = time.split(":")[0];
    const dayOfWeek = currentDate.getDay(); // Get day of the week

    hourlyData[hour] = (hourlyData[hour] || 0) + parseFloat(value);

    // Initialize hourlyDataPerDay for the current day if not present
    if (!hourlyDataPerDay[dayOfWeek]) {
      hourlyDataPerDay[dayOfWeek] = {};
    }

    // Store hourly data for the current day
    hourlyDataPerDay[dayOfWeek][hour] = (hourlyDataPerDay[dayOfWeek][hour] || 0) + parseFloat(value);
  });

  // Set start and end dates from data on initial load
  if (isInitialLoad && dates.length > 0) {
    dates.sort((a, b) => a - b); // Sort dates
    const startDate = new Date(dates[0]);
    startDate.setUTCHours(0, 0, 0, 0); // Set hours, minutes, seconds, and milliseconds to 0 in UTC
    // Adjust start date based on local time zone offset
    startDate.setDate(startDate.getDate() + 1);
    document.getElementById("startDate").valueAsDate = startDate;

    const lastDate = dates[dates.length - 1];
    document.getElementById("endDate").valueAsDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), 23, 59, 59, 999);
  }

  displayGraph(hourlyData);
  calculateBestPlan(hourlyDataPerDay); // Pass hourlyDataPerDay to calculateBestPlan
}

function displayCsvDetails(lines, startDate, endDate, sumKwh) {
  // Assuming lines[3] and lines[5] have been split correctly into relevant parts in your actual code
  // Extract and display customer details
  document.getElementById("customerName").textContent = lines[3].split(",")[0].trim().replace(/"/g, "");
  document.getElementById("customerAddress").textContent = lines[3].split(",")[1].trim().replace(/"/g, "");
  document.getElementById("meterType").textContent = lines[7].split(",")[0].trim().replace(/"/g, "");
  document.getElementById("meterNumber").textContent = lines[7].split(",")[1].trim().replace(/"/g, "");

  // Update placeholders for start date, end date, and total kWh
  document.getElementById("startDateDisplay").textContent = startDate;
  document.getElementById("endDateDisplay").textContent = endDate;
  document.getElementById("totalKwh").textContent = sumKwh.toFixed(2);
}

let myChart = null; // This variable will hold the chart instance

function displayGraph(hourlyData) {
  const canvasElement = document.getElementById('myChart');
  const ctx = canvasElement.getContext('2d');

  // Check if a chart instance already exists
  if (myChart) {
    myChart.destroy(); // Destroy the existing chart
  }

  // Proceed with creating a new chart instance
  const dataEntries = Object.entries(hourlyData);
  dataEntries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  const labels = dataEntries.map(([hour, _]) => hour);
  const values = dataEntries.map(([_, value]) => value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  function getColorForValue(value) {
    const normalized = (value - minValue) / (maxValue - minValue);
    const red = Math.round(normalized * 255);
    const green = Math.round((1 - normalized) * 255);
    return `rgb(${red}, ${green}, 0)`;
  }

  // Prepare data for Chart.js
  const dataPoints = values.map((value, index) => ({
    x: labels[index],
    y: value,
    backgroundColor: getColorForValue(value), // Use for dynamic coloring
  }));

  myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hourly Electricity Usage',
        data: dataPoints,
        backgroundColor: dataPoints.map(dp => dp.backgroundColor),
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Usage (kWh)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      },
      plugins: {
        legend: {
          display: false // Set to true if you want to display the label
        },
        title: {
          display: true,
          text: 'Hourly Electricity Usage'
        }
      }
    }
  });
}

let cachedPlans = null; // Cached plans

async function fetchPlans() {
  if (cachedPlans === null) {
    const response = await fetch("plans.json");
    cachedPlans = await response.json();
  }
  return cachedPlans;
}
window.onload = async function () {
  try {
    await fetchPlans();
  } catch (error) {
    console.error("Error fetching plans:", error);
  }
};

async function calculateBestPlan(hourlyDataPerDay) {
  const plans = await fetchPlans(); // Fetch plans from server
  const yearSelection = document.getElementById("yearSelection").value; // Get the selected year index
  const selectedYearIndex = parseInt(yearSelection, 10); // Ensure it's an integer

  let totalKwhFreePerPlan = plans.map((plan) => ({ ...plan, totalKwhFree: 0 }));

  // Iterate over each day of the week
  for (let dayOfWeek in hourlyDataPerDay) {
    if (hourlyDataPerDay.hasOwnProperty(dayOfWeek)) {
      // Convert dayOfWeek to a number for comparison
      const dayOfWeekInt = parseInt(dayOfWeek);

      // Iterate over hourly data for the current day
      Object.entries(hourlyDataPerDay[dayOfWeek]).forEach(([hour, kwh]) => {
        const hourInt = parseInt(hour); // Ensure hour is an integer

        // Update totalKwhFreePerPlan only if the plan's day of the week matches the current day
        totalKwhFreePerPlan.forEach((plan) => {
          if (plan.days_of_week.includes(dayOfWeekInt)) {
            plan.applicable_hours.forEach((planHour) => {
              if (hourInt === planHour) {
                // Determine which discount index to use
                const discountIndex = selectedYearIndex < plan.discount.length ? selectedYearIndex : plan.discount.length - 1;
                plan.totalKwhFree += kwh * (plan.discount[discountIndex] / 100);
              }
            });
          }
        });
      });
    }
  }

  displayPlanResults(totalKwhFreePerPlan);
}

function displayPlanResults(totalKwhFreePerPlan) {
  // Sort plans by the highest savings
  totalKwhFreePerPlan.sort((a, b) => b.totalKwhFree - a.totalKwhFree);

  const resultsContainer = document.getElementById("bestPlan");
  let tableHTML = `<h3>Free kWh per Plan</h3>
                     <table>
                     <tr>
                        <th>Rank</th>
                        <th>Company Name</th>
                        <th>Plan Description</th>
                        <th>Days of the Week</th>
                        <th>Hours</th>
                        <th>% Discount</th>
                        <th>Free kWh</th>
                     </tr>`;

  totalKwhFreePerPlan.forEach((plan, index) => {
    const rowClass = index === 0 ? ' class="best-plan"' : ""; // Highlight for the first row

    tableHTML += `<tr${rowClass}>
                        <td>${index + 1}</td>
                        <td>${plan.company_name}</td>
                        <td>${plan.plan_description}</td>
                        <td>${formatDaysOfWeek(plan.days_of_week)}</td>
                        <td>${formatApplicableHours(plan.applicable_hours)}</td>
                        <td>${plan.discount.join("/") + "%"}</td>
                        <td>${plan.totalKwhFree.toFixed(2)}</td>
                      </tr>`;
  });

  tableHTML += `</table>`;
  resultsContainer.innerHTML = tableHTML;
}

function formatApplicableHours(hours) {
  if (hours.length === 0) return "";

  // Special case for 24-hour coverage
  if (hours.length === 24) {
    return "All";
  }
  // Find the continuous range, assuming sorted hours
  let start = hours[0]
  let end = hours[hours.length - 1];
  return `from ${formatHour(start)} until ${formatHour(end + 1)}`; // +1 to end hour to make it inclusive
}

function formatHour(hour) {
  // Adjust for normalized 24 hour to 0 hour (midnight)
  if (hour === 24) hour = 0;
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatDaysOfWeek(days) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (days.length === 7) {
    return "All";
  } else {
    return days.map((day) => dayNames[day % 7]).join(", ");
  }
}
document.addEventListener("DOMContentLoaded", function () {
  document.querySelector(".collapsible-header").addEventListener("click", function () {
    const content = this.nextElementSibling;
    if (!content.style.maxHeight || content.style.maxHeight === "0px") {
      content.style.maxHeight = content.scrollHeight + "px";
      this.querySelector(".arrow").innerHTML = "&#9650;"; // Change arrow direction up
    } else {
      content.style.maxHeight = "0px";
      this.querySelector(".arrow").innerHTML = "&#9660;"; // Change arrow direction down
    }
  });

  // Initialize the collapsible content to be collapsed
  const initialContent = document.querySelector(".collapsible-content");
  if (initialContent) {
    initialContent.style.maxHeight = "0px"; // Ensure it starts collapsed
  }
});
