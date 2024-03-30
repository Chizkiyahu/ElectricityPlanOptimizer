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
    sortedHourlyData = Object.entries(hourlyData).sort((a, b) => {
        // Convert hour strings to numbers for comparison
        return parseInt(a[0], 10) - parseInt(b[0], 10);
    });

    displayGraph(sortedHourlyData);
    calculateBestPlan(hourlyData);
}

function displayGraph(sortedData) {
    let dataPoints = sortedData.map(([hour, value]) => ({
        label: `${hour}:00`,
        y: value
    }));

    const chart = new CanvasJS.Chart("chartContainer", {
        animationEnabled: true,
        theme: "light2",
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
    const plans = await response.json();
    return plans;
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
                        <th>Company Name</th>
                        <th>Plan Description</th>
                        <th>Free kWh</th>
                     </tr>`;

    totalKwhFreePerPlan.forEach(plan => {
        tableHTML += `<tr>
                        <td>${plan.company_name}</td>
                        <td>${plan.plan_description}</td>
                        <td>${plan.totalKwhFree.toFixed(2)}</td>
                      </tr>`;
    });

    tableHTML += `</table>`;
    resultsContainer.innerHTML = tableHTML;
}
