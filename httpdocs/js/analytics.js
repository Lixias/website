// Analytics module for simulation data visualization

// Store simulation data
const simulationData = {
    slots: {},
    cycles: [],
    currentCycle: {
        startTime: Date.now(),
        states: [],
        lostBalls: 0
    }
};

// Initialize charts
function initCharts() {
    // Initialize distribution chart
    const totalData = {
        x: [],
        y: [],
        type: 'bar',
        name: 'Total',
        marker: { color: 'rgb(166, 219, 251)' }
    };
    
    const currentData = {
        x: [],
        y: [],
        type: 'bar',
        name: 'Current',
        marker: { color: 'rgba(54, 162, 235, 0.5)' }
    };
    
    const expectedData = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines',
        line: {
            color: 'rgba(255, 99, 132, 1)',
            width: 2
        },
        name: 'Expected'
    };
    
    const layout = {
        title: 'Slot Distribution',
        font: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color')
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            title: 'Slot'
        },
        yaxis: {
            title: 'Percentage',
            tickformat: '.1%',
            range: [0, 1]
        },
        barmode: 'group',
        margin: {
            l: 50,
            r: 30,
            b: 50,
            t: 50,
            pad: 4
        },
        legend: {
            orientation: 'h',
            y: 1.1
        }
    };
    
    Plotly.newPlot('distributionChart', [totalData, currentData, expectedData], layout, {responsive: true});
    
    // Initialize timeline chart with separate lines for each state
    const waitingData = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Waiting',
        line: { color: 'rgba(54, 162, 235, 1)' }
    };
    
    const holdingData = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Holding',
        line: { color: 'rgba(255, 205, 86, 1)' }
    };
    
    const releasingData = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Releasing',
        line: { color: 'rgba(75, 192, 192, 1)' }
    };
    
    const reactivatingData = {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Reactivating',
        line: { color: 'rgba(153, 102, 255, 1)' }
    };
    
    const lostBallsData = {
        x: [],
        y: [],
        type: 'bar',
        name: 'Lost Balls',
        marker: { color: 'rgba(255, 99, 132, 0.7)' }
    };
    
    const timelineLayout = {
        title: 'Cycle State Durations & Lost Balls',
        font: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color')
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            title: 'Cycle'
        },
        yaxis: {
            title: 'Duration (ms)',
            rangemode: 'tozero'
        },
        yaxis2: {
            title: 'Lost Balls',
            overlaying: 'y',
            side: 'right',
            rangemode: 'tozero'
        },
        margin: {
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 4
        },
        legend: {
            orientation: 'h',
            y: 1.1
        },
        annotations: []
    };
    
    Plotly.newPlot('timelineChart', [waitingData, holdingData, releasingData, reactivatingData, lostBallsData], timelineLayout, {responsive: true});
}

// Update slot data
function updateSlotData(slotData) {
    simulationData.slots = slotData;
    updateDistributionChart();
}

// Record state change
function recordStateChange(previousState, newState, duration) {
    simulationData.currentCycle.states.push({
        state: previousState,
        duration: duration
    });
    
    if (newState === 'WAITING_FOR_COLLECTION' && previousState === 'REACTIVATING') {
        // Complete a cycle
        simulationData.cycles.push({...simulationData.currentCycle});
        simulationData.currentCycle = {
            startTime: Date.now(),
            states: [],
            lostBalls: 0
        };
        updateTimelineChart();
    }
}

// Record lost balls
function recordLostBalls(lostCount) {
    simulationData.currentCycle.lostBalls = lostCount;
}

// Update distribution chart
function updateDistributionChart() {
    const slots = Object.values(simulationData.slots).sort((a, b) => a.index - b.index);
    
    const xValues = slots.map(slot => `Slot ${slot.index}`);
    const totalValues = slots.map(slot => slot.totalCount > 0 ? slot.totalCount / getTotalBallCount() : 0);
    
    // Calculate current percentage values
    const currentTotal = Object.values(simulationData.slots).reduce((sum, slot) => sum + slot.currentCount, 0);
    const currentValues = slots.map(slot => currentTotal > 0 ? slot.currentCount / currentTotal : 0);
    
    const expectedValues = slots.map(slot => slot.expectedProbability);
    
    Plotly.update('distributionChart', {
        x: [xValues, xValues, xValues],
        y: [totalValues, currentValues, expectedValues]
    }, {}, [0, 1, 2]);
}

// Update timeline chart
function updateTimelineChart() {
    if (simulationData.cycles.length === 0) return;
    
    // Create data arrays for each state
    const states = ['WAITING_FOR_COLLECTION', 'HOLDING', 'RELEASING', 'REACTIVATING'];
    const stateData = {
        'WAITING_FOR_COLLECTION': { x: [], y: [], text: [] },
        'HOLDING': { x: [], y: [], text: [] },
        'RELEASING': { x: [], y: [], text: [] },
        'REACTIVATING': { x: [], y: [], text: [] }
    };
    
    // Lost balls data
    const lostBallsData = {
        x: [],
        y: [],
        text: []
    };
    
    // Annotations to clear
    const annotations = [];
    
    simulationData.cycles.forEach((cycle, index) => {
        const cycleNum = index + 1;
        
        // Process each state
        cycle.states.forEach(state => {
            if (stateData[state.state]) {
                stateData[state.state].x.push(cycleNum);
                stateData[state.state].y.push(state.duration);
                stateData[state.state].text.push(`Cycle ${cycleNum}<br>${state.state}<br>${state.duration}ms`);
            }
        });
        
        // Process lost balls
        if (cycle.lostBalls > 0) {
            lostBallsData.x.push(cycleNum);
            lostBallsData.y.push(cycle.lostBalls);
            lostBallsData.text.push(`Cycle ${cycleNum}<br>Lost: ${cycle.lostBalls} balls`);
            
            // Add annotation for lost balls
            annotations.push({
                x: cycleNum,
                y: cycle.lostBalls,
                xref: 'x',
                yref: 'y2',
                text: `${cycle.lostBalls}`,
                showarrow: false,
                font: {
                    color: 'white'
                },
                bgcolor: 'rgba(255, 99, 132, 0.7)',
                bordercolor: 'transparent',
                borderwidth: 1,
                borderpad: 4,
                ay: -20
            });
        }
    });
    
    // Update the plot
    Plotly.update('timelineChart', 
        {
            x: [
                stateData['WAITING_FOR_COLLECTION'].x,
                stateData['HOLDING'].x,
                stateData['RELEASING'].x,
                stateData['REACTIVATING'].x,
                lostBallsData.x
            ],
            y: [
                stateData['WAITING_FOR_COLLECTION'].y,
                stateData['HOLDING'].y,
                stateData['RELEASING'].y,
                stateData['REACTIVATING'].y,
                lostBallsData.y
            ],
            text: [
                stateData['WAITING_FOR_COLLECTION'].text,
                stateData['HOLDING'].text,
                stateData['RELEASING'].text,
                stateData['REACTIVATING'].text,
                lostBallsData.text
            ],
            'marker.color': [null, null, null, null, 'rgba(255, 99, 132, 0.7)']
        },
        {
            annotations: annotations,
            'yaxis.rangemode': 'tozero'
        },
        [0, 1, 2, 3, 4]
    );
    
    // Update the lost balls data to use the second y-axis
    Plotly.restyle('timelineChart', { yaxis: 'y2' }, [4]);
}

// Get total ball count
function getTotalBallCount() {
    return Object.values(simulationData.slots).reduce((sum, slot) => sum + slot.totalCount, 0);
}

// Initialize analytics on page load
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    
    // Update charts on tab show to fix layout issues
    const tabs = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', event => {
            if (event.target.id === 'distribution-tab') {
                Plotly.relayout('distributionChart', {});
            } else if (event.target.id === 'timeline-tab') {
                Plotly.relayout('timelineChart', {});
            }
        });
    });
});

// Export functions for use in simulation.js
export { updateSlotData, recordStateChange, recordLostBalls }; 