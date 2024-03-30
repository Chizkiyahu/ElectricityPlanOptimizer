// Initial setup to add event listeners to the file input and filters
document.getElementById('fileInput').addEventListener('change', function(event) {
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
        const text = fileLoadedEvent.target.result;
        processData(text, true); // True indicates this is the initial load
    };
    fileReader.readAsText(event.target.files[0], "UTF-8");
});

// Function to apply filters automatically without a dedicated button
function applyFiltersAutomatically() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length > 0) {
        const fileReader = new FileReader();
        fileReader.onload = function(fileLoadedEvent) {
            const text = fileLoadedEvent.target.result;
            processData(text, false); // False for subsequent loads
        };
        fileReader.readAsText(fileInput.files[0], "UTF-8");
    }
}

// Attach event listeners to filter inputs for automatic reprocessing
document.getElementById('startDate').addEventListener('change', applyFiltersAutomatically);
document.getElementById('endDate').addEventListener('change', applyFiltersAutomatically);
document.querySelectorAll('#dayFilters input').forEach(input => input.addEventListener('change', applyFiltersAutomatically));

function processData(csvData, isInitialLoad) {
    const lines = csvData.split('\n').slice(12); // Adjust if header lines count changes
    let hourlyData = {};
    let dates = [];

    lines.forEach(line => {
        const [date, time, value] = line.split(',').map(part => part.replace(/"/g, ''));
        if (!date || !time || !value) return; // Skip incomplete lines

        // Split the date string into components
        const [day, month, year] = date.split('/').map(Number); // Convert each part to a number

        // Create a new Date object using the year, month, and day
        // Note: Months are 0-indexed in JavaScript's Date, so subtract 1 from the month
        const currentDate = new Date(year, month - 1, day);
        dates.push(currentDate); // Collect all dates for initial load processing

        // Filter application
        const startDateFilter = document.getElementById('startDate').value;
        const endDateFilter = document.getElementById('endDate').value;
        const dayFilters = [...document.querySelectorAll('#dayFilters input[type="checkbox"]:checked')].map(el => parseInt(el.value));

        if ((startDateFilter && currentDate < new Date(startDateFilter)) || (endDateFilter && currentDate > new Date(endDateFilter)) || !dayFilters.includes(currentDate.getDay())) {
            return; // Skip this entry if it doesn't match the filters
        }

        const hour = time.split(':')[0];
        hourlyData[hour] = (hourlyData[hour] || 0) + parseFloat(value);
    });

    // Set start and end dates from data on initial load
    if (isInitialLoad && dates.length > 0) {
        dates.sort((a, b) => a - b); // Sort dates
        document.getElementById('startDate').valueAsDate = dates[0];
        document.getElementById('endDate').valueAsDate = dates[dates.length - 1];
    }
    displayGraph(hourlyData);
    calculateBestPlan(hourlyData);
}

function displayGraph(hourlyData) {
    const dataEntries = Object.entries(hourlyData);
    dataEntries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    const values = dataEntries.map(([_, value]) => value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    // Function to interpolate between green and red based on value
    function getColorForValue(value) {
        // Normalize value between 0 and 1
        const normalized = (value - minValue) / (maxValue - minValue);
        // Calculate red and green components based on normalized value
        // Green to Red gradient: (1-normalized) for green and normalized for red
        const red = Math.round(normalized * 255);
        const green = Math.round((1 - normalized) * 255);
        // Return RGB color string
        return `rgb(${red}, ${green}, 0)`;
    }

    // Map hourlyData to dataPoints with color based on value
    let dataPoints = dataEntries.map(([hour, value]) => ({
        label: hour + ':00',
        y: value,
        color: getColorForValue(value) // Dynamic color based on value
    }));

    const chartTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark1" : "light2";

    const chart = new CanvasJS.Chart("chartContainer", {
        animationEnabled: true,
        theme: chartTheme,
        title: {
            text: "Hourly Electricity Usage"
        },
        axisX: {
            title: "Time",
            interval: 1
        },
        axisY: {
            title: "Usage (kWh)",
            includeZero: true
        },
        data: [{
            type: "column",
            dataPoints: dataPoints
        }]
    });
    chart.render();
}
async function fetchPlans() {
    const response = await fetch('plans.json');
    return await response.json();
}

async function calculateBestPlan(hourlyData) {
    const plans = await fetchPlans(); // Fetch plans from server

    let totalKwhFreePerPlan = plans.map(plan => ({...plan, totalKwhFree: 0}));

    Object.entries(hourlyData).forEach(([hour, kwh]) => {
        const hourInt = parseInt(hour); // Ensure hour is an integer

        totalKwhFreePerPlan.forEach(plan => {
            plan.applicable_hours.forEach(planHour => {
                if (hourInt === planHour) {
                    plan.totalKwhFree += kwh * (plan.discount[0] / 100); // Assuming single discount for simplicity
                }
            });
        });
    });

    displayPlanResults(totalKwhFreePerPlan);
}

function displayPlanResults(totalKwhFreePerPlan) {
    // Sort plans by the highest savings
    totalKwhFreePerPlan.sort((a, b) => b.totalKwhFree - a.totalKwhFree);

    const resultsContainer = document.getElementById('bestPlan');
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
        const rowClass = index === 0 ? ' class="best-plan"' : ''; // Highlight for the first row

        tableHTML += `<tr${rowClass}>
                        <td>${index + 1}</td>
                        <td>${plan.company_name}</td>
                        <td>${plan.plan_description}</td>
                        <td>${formatDaysOfWeek(plan.days_of_week)}</td>
                        <td>${formatApplicableHours(plan.applicable_hours)}</td>
                        <td>${plan.discount.join('% & ') + '%'}</td>
                        <td>${plan.totalKwhFree.toFixed(2)}</td>
                      </tr>`;
    });

    tableHTML += `</table>`;
    resultsContainer.innerHTML = tableHTML;
}



function formatApplicableHours(hours) {
    if (hours.length === 0) return '';

    // Special case for 24-hour coverage
    if (hours.length === 24) {
        return 'All';
    }

    // Normalize hours by sorting and handling the midnight wrap-around
    let normalizedHours = hours.map(hour => hour === 0 ? 24 : hour).sort((a, b) => a - b);

    // Find the continuous range, assuming sorted hours
    let start = normalizedHours[0];
    let end = start;
    let foundBreak = false;

    for (let i = 1; i < normalizedHours.length; i++) {
        // If we find a non-consecutive hour and haven't found a break yet, mark the end
        if (normalizedHours[i] !== end + 1 && !foundBreak) {
            foundBreak = true;
        }
        end = normalizedHours[i];
    }

    // Adjust for wrapping by subtracting 24 from the end if it exceeds 24
    if (end === 24) end = 0;

    // Format the output string
    return `from ${formatHour(start)} until ${formatHour(end + 1)}`; // +1 to end hour to make it inclusive
}

function formatHour(hour) {
    // Adjust for normalized 24 hour to 0 hour (midnight)
    if (hour === 24) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
}

function formatDaysOfWeek(days) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    if (days.length === 7) {
        return 'All';
    } else {
        // Adjust for one-based indexing of days
        return days.map(day => dayNames[(day - 1) % 7]).join(', ');
    }
}



