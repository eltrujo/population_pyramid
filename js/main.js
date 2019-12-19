// Define constants
var kBlue = '#4682B4',
    kPink = '#EE7989',
    kMarginBottom = 10,
    kMarginLeft = 15;

// Append SVG
var svg = d3.select('#pyramid_container').append('svg');

// Initialize variables
var data;

function load_data(year) {
    d3.csv('../data/Spain/' + year + '.csv').then(function (data_) {
        data = data_;
        main();
    })
}


function update_bars() {
    // Update male bars
    var bars = svg.selectAll('.male_bar').data(data);

    bars.enter() // for new elements in 'nodes' array
        .append('rect')
        .attr('class', 'male_bar')
        .attr('x', function (d, i) {
            compute_x_male(i)
        })
        .attr('y', function (d, i) {
            compute_y_male(i)
        })
        .attr('width', function (d, i) {
            compute_width_male(i)
        })
        .attr('height', function (d, i) {
            compute_height_male(i)
        })
        .merge(bars) // merges newly added elements to the previous ones
        .attr('cx', function (d) {
            return d.x;
        })
        .attr('cy', function (d) {
            return d.y;
        });

    bars.exit().remove(); // exit selection and remove duplicates
}

function main() {
    console.log(data)
}

load_data(2100)


function update_canvas(step) {
    /**
     * Updates all SVGs (dashboards only if the switch is ON) to the desired week.
     * 
     * @param {int} step The current week number.
     */

    current_week = step

    update_forces(); // update attraction force for every node
    compute_counters();
    update_temporal_counters(current_week);

    if (dashboards_on) {
        update_dashboards();
    }
    setTimeout(update_counters_transition, time_gap * 0.5) // update sector counters with transition
    force_interval = setInterval(function () {
        simulation.alpha(alpha)
        simulation.restart();
    }, time_force_refresh) // update and continuously refresh forces for 'time_force_refresh' period of time
    setTimeout(function stopInterval() { clearInterval(force_interval); }, time_gap)
}

function setup_dashboards() {
    /**
     * Start dashboard classes.
     */
    return [new PieChart(colorScale.slice(numSpCat - 1)), new BarChart(categories, numSectors)];
}

function create_nodes() {
    /**
     * Create nodes, with each node representing one consultant.
     */
    var numNodes = data.consultant_ids.length;
    var nodes = d3.range(numNodes).map(function (d, i) {
        return {
            radius: radius,
            name: data.consultant_ids[i],
            catColor: 'Init',
            catPosition: 'Init'
        }
    });
    return nodes;
}

function set_simulation() {
    /**
     * Set up the force system.
     */
    simulation = d3.forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(2)) // nodes attract each other (if "strength" was negative it would be a repulsion force)
        .force('x', d3.forceX().x(function (d) {
            return categories['Init'].xCenter;
        })) // horizontal force towards its corresponding category
        .force('y', d3.forceY().y(function (d) {
            return categories['Init'].yCenter;
        })) // vertical force towards its corresponding category
        .force('collision', d3.forceCollide().radius(function (d) {
            return d.radius * collision_force_ratio;
        })) // collision detection to avoid overlapping
        .on('tick', ticked);
}

function play_simulation() {
    if (current_week < final_week && !progressBar.stop_simulation) {
        // Advance one week in the simulation if no week was clicked and end is not reached
        current_week++
        progressBar.next_step()
        update_canvas(current_week)
        setTimeout(play_simulation, time_gap);
    } else {
        // Finish simulation
        console.log('Simulation finished');
    }
}

function update_forces() {
    // Define color and attraction force for each consultant
    simulation
        // Update force in X axis
        .force('x', d3.forceX().x(function (d, i) {
            // Update color and force only if there's a change
            if (d.name in data.flow['W'.concat(paddy(current_week))]) {
                // Retrieve color and attraction force
                var catCol = defineCategoryColor(data.flow['W'.concat(paddy(current_week))][d.name]);
                var catPos = defineCategoryPosition(data.flow['W'.concat(paddy(current_week))][d.name]);
                // Update 'nodes' object
                nodes[i].catColor = catCol;
                nodes[i].catPosition = catPos;
                return categories[catPos].xCenter;
            } else {
                return categories[nodes[i].catPosition].xCenter;
            }
        }).strength(force_strength))
        // Update force in Y axis
        .force('y', d3.forceY().y(function (d, i) {
            // Update color and force only if there's a change
            if (d.name in data.flow['W'.concat(paddy(current_week))]) {
                // Retrieve color and attraction force
                var catCol = defineCategoryColor(data.flow['W'.concat(paddy(current_week))][d.name]);
                var catPos = defineCategoryPosition(data.flow['W'.concat(paddy(current_week))][d.name]);
                // Update 'nodes' object
                nodes[i].catColor = catCol;
                nodes[i].catPosition = catPos;
                return categories[catPos].yCenter;
            } else {
                return categories[nodes[i].catPosition].yCenter;
            }
        }).strength(force_strength))
        .alpha(alpha) // increase temperature of simulation
        .restart();
}

function compute_counters() {
    // Set counters to zero
    Object.keys(categories).map(function (key, index) {
        categories[key].counter = 0;
    });
    // Recompute counters
    nodes.map(function (cons) {
        categories[cons.catPosition].counter++;
    })
}

function update_counters_transition() {
    // This function updates labels and counters as one text element
    // Update text fields with counter values
    var texts = svg.selectAll('.label_counter').data(categoryNames);
    // 'enter' is used for the elements with no value
    // This happens at the beginning and when the data array has a different size
    texts.enter().append('text')
        .attr('x', function (d) { return categories[d].xCenter }) // to avoid flickering of the category labels, remove "text-anchor: middle" and add: ".attr('x', function (d) { return categories[d].xCenter - d.length * label_font_size / 2.6 })"
        .attr('y', function (d) { return categories[d].yLabel })
        .attr('class', 'label_counter')
        .attr('stroke', function (d) { return categories[d].color })
        .text(function (d) { return d + ' · ' + categories[d].counter })
        .merge(texts) // merges newly placed elements (by enter) with the existing ones
        .transition()
        .duration(700)
        .tween('text', function (d) {
            var i = d3.interpolateRound(parseInt(this.textContent.split(label_sep)[1]), categories[d].counter);
            return function (t) {
                this.textContent = d + label_sep + i(t);
            }
        })

    // Exit selection
    // Remove elements of the array that were not inserted into an HTML element
    texts.exit().remove();
}

function update_temporal_counters(week_number) {
    // Update week with transition animation
    svg.select('#week_counter')
        .transition()
        .duration(700)
        .tween('text', function (d) {
            var i = d3.interpolateRound(parseInt(this.textContent.slice(-2)), week_number)
            return function (t) {
                this.textContent = 'Week '.concat(paddy(i(t)));
            }
        })

    // Update month with transition animation
    svg.select('#month_counter')
        .transition()
        .duration(700)
        .tween('text', function (d) {
            var i = d3.interpolateRound(months.indexOf(this.textContent), months.indexOf(get_month_by_week(week_number)))
            return function (t) {
                this.textContent = months[i(t)];
            }
        })

}

function remove_dashboards() {
    /**
     * Remove key elements of each dashboard's respective SVGs.
     */
    pieChart.remove_pie_chart();
    barChart.remove_bar_chart();
}

function update_dashboards() {
    /**
     * Update dashboards to show data of selected week.
     */
    setTimeout(function () { pieChart.update_pie_chart(categories) }, 1);
    setTimeout(function () { barChart.update_bar_chart(nodes) }, 1);
}

function ticked() {
    // This will be called after every tick of the force system
    var u = d3.select('#flow_svg')
        .selectAll('circle')
        .data(nodes);

    u.enter() // for new elements in 'nodes' array
        .append('circle')
        .attr('r', function (d) {
            return d.radius;
        })
        .merge(u) // merges newly added elements to the previous ones
        .attr('cx', function (d) {
            return d.x;
        })
        .attr('cy', function (d) {
            return d.y;
        })
        .style('fill', function (d) {
            try {
                return categories[d.catColor].color;
            } catch (error) {
                console.log('Error')
                console.log(d)
                sleep(20000)
            }
        })

        // Hover effects: change its opacity slightly and display consultant ID
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut);

    u.exit().remove(); // exit selection and remove unassigned elements

}

function handleMouseOver(d, i) {
    // Set opacity to 75%
    d3.select(this).transition()
        .duration('50')
        .attr('opacity', '.75');

    // Display consultant name with a text element
    svg.append('text')
        .attr('id', 't_' + d.name)
        .attr('x', d.x - d.radius - 5)
        .attr('y', d.y)
        .attr('text-anchor', 'end')
        .text(d.name);
}

function handleMouseOut(d, i) {
    // Set opacity to 100%
    d3.select(this).transition()
        .duration('50')
        .attr('opacity', '1');

    // Remove text element displaying consultant name
    d3.select('#t_' + d.name).remove()
}

function defineCategoryColor(cons) {
    if (cons.sector == 'Init' || cons.sector == 'Resigned' || cons.sector == 'Dismissed' || cons.sector == 'AKKA NL') {
        return cons.sector;
    } else {
        if (cons.akkademy && !cons.has_started) {
            return 'AKKAdemy';
        } else if (!cons.akkademy && !cons.has_started) {
            return 'Pre-hire';
        } else {
            return cons.sector;
        }
    }
}

function defineCategoryPosition(cons) {
    if (cons.sector == 'Init' || cons.sector == 'Resigned' || cons.sector == 'Dismissed' || cons.sector == 'AKKA NL') {
        return cons.sector;
    } else {
        if (cons.akkademy && !cons.has_started) {
            return 'AKKAdemy';
        } else if (!cons.akkademy && !cons.has_started) {
            return 'Pre-hire';
        } else {
            if (cons.bench) {
                return 'Bench';
            } else {
                return cons.sector;
            }
        }
    }
}

function place_toggle_switch() {
    // Toggle switch for flow animation
    SaVaGe.ToggleSwitch({
        container: '#dashboards_switch_container', height: 30, value: false, backRight: '#4DC87F',
        onChange: function (toggler) {
            dashboards_on = toggler.getValue();
            if (!dashboards_on) {
                remove_dashboards();
            } else if (dashboards_on && progressBar.stop_simulation) {
                update_dashboards();
            }
        }
    })

    // Place text
    d3.select('#dashboards_switch_container').append('label')
        .text('Dashboards')
        .attr('class', 'switch_label');
}

function place_temporal_counters() {
    svg.append('text')
        .attr('id', 'year_counter')
        .attr('class', 'temporal_counter')
        .attr('x', 10)
        .attr('y', 10 + week_counter_font_size / 2)
        .text('2019');
    svg.append('text')
        .attr('id', 'week_counter')
        .attr('class', 'temporal_counter')
        .attr('x', 10)
        .attr('y', 10 + 3 * week_counter_font_size / 2)
        .text('Week '.concat(paddy(current_week)));
    svg.append('text')
        .attr('id', 'month_counter')
        .attr('class', 'temporal_counter')
        .attr('x', 10)
        .attr('y', 10 + 5 * week_counter_font_size / 2)
        .text(get_month_by_week(current_week))
}

function create_categories() {
    // Compute centroids of categories
    var xCenters = [width / 3, width / 7, 6 * width / 7, 10 * width / 11, 10 * width / 11, width / 2];
    var yCenters = [-height / 5, height / 2, height / 2, height / 8, 8 * height / 9, height / 2];
    var R = height * 0.35; // radius of the circumference of sectors
    var theta = 2 * Math.PI / numSectors; // angular step between sectors
    var phi = Math.PI / 2; // angular offset
    for (var i = 0; i < numSectors; i++) {
        xCenters.push(R * Math.cos((i * theta) + phi) + width / 2);
        yCenters.push(R * Math.sin((i * theta) + phi) + height / 2);
    }

    // Create Object with the category names as keys
    var categories = new Object();
    var yLabel;
    for (i = 0; i < categoryNames.length; i++) {
        if (categoryNames[i] == 'Bench' || categoryNames[i] == 'Pre-hire' || categoryNames[i] == 'AKKA NL') {
            yLabel = yCenters[i] - yDisp - 30
        } else {
            yLabel = yCenters[i] - yDisp
        }
        categories[categoryNames[i]] = {
            id: i,
            color: colorScale[i],
            xCenter: xCenters[i],
            yCenter: yCenters[i],
            yLabel: yLabel,
            counter: 0,
        }
    }

    return categories
}

function get_month_by_week(week_number) {
    var idx = Math.min(Math.floor(week_number * 0.230137), 11)

    return months[idx]
}

function paddy(num, padchar) {
    var padlen = 2;
    var pad_char = typeof padchar !== 'undefined' ? padchar : '0';
    var pad = new Array(1 + padlen).join(pad_char);

    return (pad + num).slice(-pad.length);
}

function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}

function display_centroids() {
    /**
     * Place circular ellipses on the category centroids. (Not used)
     */
    for (var i = 0; i < Object.keys(categories).length; i++) {
        svg.append('ellipse')
            .attr('cx', categories[categoryNames[i]]['xCenter'])
            .attr('cy', categories[categoryNames[i]]['yCenter'])
            .attr('rx', 10)
            .attr('ry', 10)
    }
}