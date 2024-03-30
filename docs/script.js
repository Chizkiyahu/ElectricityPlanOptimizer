document.getElementById('fileInput').addEventListener('change', function(event) {
    const fileReader = new FileReader();
    fileReader.onload = function(fileLoadedEvent) {
        const text = fileLoadedEvent.target.result;
        processData(text);
    };
    fileReader.readAsText(event.target.files[0], "UTF-8");
});

function processData(csvData) {
    const lines = csvData.split('\n').slice(12); // Skipping the first 12 header lines
    let hourlyData = {};

    lines.forEach(line => {
        const [date, time, value] = line.split(',');
        if (!date || !time || !value) return; // Skip incomplete lines

        const hour = time.split(':')[0].replace(/"/g, '');
        if (!hourlyData[hour]) {
            hourlyData[hour] = 0;
        }
        hourlyData[hour] += parseFloat(value);
    });

    displayGraph(hourlyData);
    calculateBestPlan(hourlyData);
}

function displayGraph(hourlyData) {
    let dataPoints = Object.entries(hourlyData).map(([hour, value]) => ({
        label: hour + ':00',
        y: value
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



