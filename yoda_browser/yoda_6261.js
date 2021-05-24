var alleles = ['T_29_P', 'S_35_R', 'A_65_T', 'N_66_K', 'Q_69_P', 'K_82_D', 'S_83_F', 'T_84_A', 'S_85_G', 'A_87_V', 'L_112.1_V'];

var allele_divs = [];
var v;

var clicked_variant;
var variants_in_selection;
var variant_selected_index = 0;

var alleles_fixed = [];
var alleles_colored = [];
for (let i=0; i<alleles.length; i++) {
  alleles_fixed.push('either');
}

var color_wheel = ["#0173b2","#de8f05","#029e73","#d55e00","#cc78bc","#ca9161","#ece133","#56b4e9"];

var color_wheel_rgb = [];
for (let c of color_wheel) {
  color_wheel_rgb.push(d3.color(c));
}

var main_data;
var main_svg;
var use_data;
var kd_data = {'H1': {}, 'H9': {}};
var kd_conc_map = {
  'H9': [-14, -12, -11.5, -11, -10.5, -10, -9.5, -9, -8.5,-8, -7.5, -7],
  'H1': [-14, -12, -11.5, -11, -10.5, -10, -9.5, -9, -8.5,-8, -7.5, -7]
}

var xs;
var ys;
var violin_y = d3.scaleLinear().domain([0,1]).range([50,580]);
var x_by_kd = d3.scaleLinear().domain([7,10]).range([630,790]);
var color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([7,10]);
var color_by_freq = d3.scaleSequential(d3.interpolateRgb("white", "red")).domain([0,1]);
var kd_curve_x = d3.scaleLinear().domain([-15,-5]).range([450,600]);
var kd_curve_y = d3.scaleLinear().domain([2,5]).range([580,500]);

var canvasWidth = 800;
var canvasHeight = 600;
var canvas;
var ctx;
var canvasData;
var colorMap = {};
var hoverMap = [];

var click_circles = [];

var data_by_variant = {};

var kd_var = 'H1';
var kd_axis;

var violin_y_pos_counter = {}; //formatted like genotype: [y_baseline_position, dict from ypos to counter of pixels (for y displacement)]

var pixel_hover_range = 15 // 15 is minimum pixel for hover behavior

for (let i=0; i<canvasWidth; i++) {
  hoverMap.push([]);
  for (let j=0; j<canvasHeight; j++) {
    hoverMap[i].push({'variant': 'none', 'point_location': null, 'dist': pixel_hover_range}); 
  }
}

// DRAWING

// That's how you define the value of a pixel //
//https://stackoverflow.com/questions/7812514/drawing-a-dot-on-html5-canvas//
function drawPixel(x, y, r, g, b, a) {
  let index = (x + y * canvasWidth) * 4;

  canvasData.data[index + 0] = r;
  canvasData.data[index + 1] = g;
  canvasData.data[index + 2] = b;
  canvasData.data[index + 3] = a;
}

function clearImageData() {
  for (let i=0; i<canvasData.data.length; i++) {
    canvasData.data[i]=255;
  }
}

function draw_data() {
  clearImageData();
  for (let d of use_data) {
    let [x, y, r, g, b, a, kx, ky] = [d['x'], d['y'], d['r'], d['g'], d['b'], d['a'], d['kdx'], d['kdy']];
    drawPixel(kx, ky, r, g, b, a);
    for (let i=0; i<4; i++) {
      for (j=0; j<4; j++) {
        if (!(((i==0) || (i==3)) && ((j==0) || (j==3)))) {
          drawPixel(x-1+i, y-1+j, r, g, b, a);
        }
      }
    }
    //drawPixel(canvasData, x, y, r, g, b, 255);
    //drawPixel(canvasData, x-1, y, r, g, b, 255);
    //drawPixel(canvasData, x+1, y, r, g, b, 255);
    //drawPixel(canvasData, x, y-1, r, g, b, 255);
    //drawPixel(canvasData, x, y+1, r, g, b, 255);
  }
  ctx.putImageData(canvasData, 0, 0);
}

function draw_brush_only() {
  for (let d of use_data) {
    let [x, y, a, kx, ky] = [d['x'], d['y'], d['a'], d['kdx'], d['kdy']];
    let index = (kx + ky * canvasWidth) * 4;
    canvasData.data[index + 3] = a;
    for (let i=0; i<4; i++) {
      for (j=0; j<4; j++) {
        if (!(((i==0) || (i==3)) && ((j==0) || (j==3)))) {
          index = ((x-1+i) + (y-1+j) * canvasWidth) * 4;
          canvasData.data[index + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(canvasData, 0, 0);
}

function reset_violin_y() {
  violin_y_pos_counter = {}
  for (let d of use_data) {
    d['kdy'] = get_violin_y(d['kdx'], d);
  }
}

function color_data(first_time=false) {
  for (let d of main_data) {
    let geno_str = ''; // genotype string
    let ypos_counter = 0;
    let v = d['variant'];
    let tmp_color;
    if (alleles_colored.length==0) {
      tmp_color = d['kd_color'];
    } else {
      let color_index = 0;
      for (let i=0; i<alleles_colored.length; i++) {
        color_index += (2**i)*Number(v[alleles_colored[i]]);
        geno_str += d['variant'][alleles_colored[i]] + ' ';
        ypos_counter += (2**i)*Number(v[alleles_colored[i]]);
      }
      tmp_color = color_wheel_rgb[color_index];
    }
    colorMap[d['variant']] = tmp_color;
    d['geno_str'] = geno_str;
    d['ypos_base'] = violin_y((ypos_counter+1)/(2**alleles_colored.length+1));
    d['r'] = tmp_color['r'];
    d['g'] = tmp_color['g'];
    d['b'] = tmp_color['b'];
    if (first_time) d['a'] = 255;
  }
  reset_violin_y();
  d3.selectAll('.geno_label').remove();
  for (let i=0; i<alleles_colored.length; i++) {
    // making the ylabels for the violin plot
    main_svg.selectAll('.NOTHING')
      .data(Object.keys(violin_y_pos_counter))
      .enter()
      .append('text')
        .attr('class', 'geno_label')
        .attr('x', 800+i*40)
        .attr('y', function(d) { return violin_y_pos_counter[d][0]+10; })
        .html(function(d) { return d.split(" ")[i]; });
    //making headings for those labels (locus #s)
    main_svg.append('text')
      .attr('class', 'geno_label')
      .attr('x', 800+i*40)
      .attr('y', violin_y(0)+20)
      .html(alleles[alleles_colored[i]].split('_')[1]);
    if (i==0) {
      main_svg.append('text')
        .attr('class', 'geno_label')
        .attr('x', 750)
        .attr('y', violin_y(0)+20)
        .html('Locus:');
    }
  }
  

  draw_data();
  
}

// INTERACTION


function flip_allele(index, allele) {
  if (alleles_fixed[index]==allele) {
    alleles_fixed[index] = 'either';
  } else {
    alleles_fixed[index] = allele;
  }
  d3.select('#new_allele_'+String(index)).classed('locked_allele', alleles_fixed[index]=='1');
  d3.select('#wt_allele_'+String(index)).classed('locked_allele', alleles_fixed[index]=='0');
  filter_data();
}


function color_allele(index) {
  if (alleles_colored.indexOf(index)>-1) {
    alleles_colored.splice(alleles_colored.indexOf(index), 1);
  } else if (alleles_colored.length==3) {
    alleles_colored.shift();
    alleles_colored.push(index);
  } else {
    alleles_colored.push(index);
  }
  for (let i=0; i<alleles.length; i++) {
    d3.select('#allele_color_button_'+String(i)).classed('colored_allele', alleles_colored.indexOf(i)>-1);
  }
  color_data();
}

function calc_percentages(variants) {
  if ([0,main_data.length].indexOf(variants.length)==-1) {
    let allele_counts = []
    for (let i=0; i<alleles.length; i++) {
      allele_counts.push(0);
    }
    for (let v of variants) {
      for (let i=0; i<alleles.length; i++) {
        if (v[i]=='1') allele_counts[i]++;
      }
    }
    for (let i=0; i<alleles.length; i++) {
      let freq = allele_counts[i]/variants.length;
      d3.select('#allele_freq_'+String(i))
        .html(String(freq).slice(0,5))
        .style('background-color', color_by_freq(freq));

    }
  } else {
    for (let i=0; i<alleles.length; i++) {
      d3.select('#allele_freq_'+String(i))
          .html('')
          .style('background-color', 'white');
    }
  }
}

// Function that is triggered when brushing is performed
function process_brush(event) {
  let extent = event.selection;
  variants_in_selection = [];
  if (extent[0][0] == extent[1][0]) { // zero area brush, undo it all
    for (let d of main_data) {
      d['a'] = 255;
      variants_in_selection.push(d['variant']);
    }
  } else {
    for (let d of main_data) {
      if ((extent[0][0] <= d['x'] && d['x'] <= extent[1][0] && extent[0][1] <= d['y'] && d['y'] <= extent[1][1]) ||
          (extent[0][0] <= d['kdx'] && d['kdx'] <= extent[1][0] && extent[0][1] <= d['kdy'] && d['kdy'] <= extent[1][1])) {
        d['a'] = 255;
        variants_in_selection.push(d['variant']);
      } else {
        d['a'] = 50;
      }
    }
  }
  this.variants_count = use_data.filter(d => d.a==255).length;
  d3.select('#total_var_count').html('# genotypes: ' + String(this.variants_count))
  if (variants_in_selection.length>0) calc_percentages(variants_in_selection);
  draw_brush_only();
}

function filter_data() {
  use_data = main_data.filter(function(d) {
    for (let i=0; i<alleles_fixed.length; i++) {
      if (alleles_fixed[i] != 'either') {
        if (d['variant'][i]!=alleles_fixed[i]) return false;
      }
    }
    return true;
  });
  this.variants_count = use_data.filter(d => d.a==255).length;
  d3.select('#total_var_count').html('# genotypes: ' + String(this.variants_count))
  reset_violin_y();
  draw_data();
  update_hover_map();
}

function highlight_variant(variant) {
  if (variant != 'none') {
    for (let i=0; i<variant.length; i++) {
      d3.select('#wt_allele_'+String(i)).classed('active_allele', variant[i]=='0');
      d3.select('#new_allele_'+String(i)).classed('active_allele', variant[i]=='1');
    }
  } else {
    if (clicked_variant) {
      for (let i=0; i<clicked_variant.length; i++) {
        d3.select('#wt_allele_'+String(i)).classed('active_allele', clicked_variant[i]=='0');
        d3.select('#new_allele_'+String(i)).classed('active_allele', clicked_variant[i]=='1');
      }
    } else {
      d3.selectAll('.allele').classed('active_allele', false);
    }
  }
}

function iterate_over_points(which_way, shift_pressed) {
  if (variants_in_selection.length>0) {
    variant_selected_index += which_way;
    if (variant_selected_index < 0) {
      variant_selected_index = variants_in_selection.length-1;
    } else if (variant_selected_index >= variants_in_selection.length) {
      variant_selected_index = 0;
    }
    click_variant(variants_in_selection[variant_selected_index]);
  }
}

function plot_kd_curve(variant) {
  let tmp_row = kd_data[kd_var].params({v_focus: variant}).filter((d,$) => d.variant == $.v_focus);
  v = tmp_row;
  let suffixes = ['_x', '_y', ''];
  //main_svg.selectAll('.kd_curve_point').remove();
  main_svg.selectAll('.kd_curve_line').remove();
  for (let i=0; i<3; i++) {
    let points = [];
    for (let j=1; j<13; j++) {
      /*
      main_svg.append('circle')
        .attr('class', 'kd_curve_point')
        .attr('r', 3)
        .attr('cx', kd_curve_x(j))
        .attr('cy', kd_curve_y(tmp_row['c'+String(j)+suffixes[i]]))
        .attr('fill', color_wheel[i]);
      */
      let xspot = kd_curve_x(kd_conc_map[kd_var][12-j]);
      let yspot_val = tmp_row.get('c'+String(j)+suffixes[i], 0);
      let yerr_zone = [yspot_val-tmp_row.get('e'+String(j)+suffixes[i], 0), yspot_val+tmp_row.get('e'+String(j)+suffixes[i], 0)];
      points.push([xspot, kd_curve_y(yspot_val)]);
      main_svg.append('path')
        .attr('class', 'kd_curve_line')
        .attr('stroke', color_wheel[i])
        .attr('stroke-width', 1)
        .attr('d', d3.line()([[xspot, kd_curve_y(yerr_zone[0])], [xspot, kd_curve_y(yerr_zone[1])]]));
    }
    main_svg.append('path')
      .attr('class', 'kd_curve_line')
      .attr('stroke', color_wheel[i])
      .attr('stroke-width', 2)
      .attr('d', d3.line()(points));
    
    d3.select('#kd_curve_title').html(variant);
  }
}

function click_variant(variant) {
  click_circles[0]
    .attr('cx', xs(data_by_variant[variant]['fdl_x']))
    .attr('cy', ys(data_by_variant[variant]['fdl_y']))
    .attr('fill', colorMap[variant].formatHex())
    .attr('opacity', 1);
  click_circles[1]
    .attr('cx', data_by_variant[variant]['kdx'])
    .attr('cy', data_by_variant[variant]['kdy'])
    .attr('fill', colorMap[variant].formatHex())
    .attr('opacity', 1);
  variant_selected_index = variants_in_selection.indexOf(variant);
  clicked_variant = variant;
  highlight_variant(variant);
  //console.log('clicked on', variant);
  plot_kd_curve(variant);
}

function check_for_hover_call(x, y, xe, ye, d, xo, yo) { // xo and yo are the corresponding points coordinates (from the violin plot or main plot)
  for (let i=-1*pixel_hover_range; i<pixel_hover_range+1; i++) {
    let tmp_x = x+i;
    for (let j=-1*pixel_hover_range; j<pixel_hover_range+1; j++) {
      let tmp_y = y+j;
      if ( ((tmp_x>-1) && (tmp_x<canvasWidth))  && ((tmp_y>-1) && (tmp_y<canvasHeight)) ) {
        let dist = Math.sqrt((tmp_x-xe)**2 + (tmp_y-ye)**2);
        if (dist < hoverMap[tmp_x][tmp_y]['dist']) {
          hoverMap[tmp_x][tmp_y]['dist'] = dist;
          hoverMap[tmp_x][tmp_y]['variant'] = d['variant'];
          hoverMap[tmp_x][tmp_y]['point_location'] = [x+1, y+1, xo+1, yo+1]; // TO-DO Again, this is a little hacky
        }
      }
    }
  }
}

function update_hover_map() {
  for (let i=0; i<canvasWidth; i++) {
    for (let j=0; j<canvasHeight; j++) {
      hoverMap[i][j] = {'variant': 'none', 'point_location': null, 'dist': pixel_hover_range}; 
    }
  }
  for (let d of use_data) {
    let [x, y, xe, ye, kx, ky] = [d['x'], d['y'], d['x_exact'], d['y_exact'], d['kdx'], d['kdy']];
    check_for_hover_call(x, y, xe, ye, d, kx, ky);
    //check_for_hover_call(kx, ky, kx, ky, d, x, y); // not allowing hover for violin plot points, just saying that brushing is better
  }
}

function setup_left_bar() {

  d3.selectAll('#yoda_left_bar')
    .append('div')
      .attr('id', 'total_var_count')
      .html('# genotypes: ' + String(this.variants_count));

  d3.select('#yoda_left_bar').selectAll('.allele_div')
    .data(alleles)
    .enter()
    .append('div')
      .attr('class', 'allele_div')
      .style('border-bottom', function(d, i) { return (i==alleles.length-1) ? 'none' : '1px solid black'}); //no border on last one

  /*d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_number')
      .html(function(d, i) { return String(i+1); });
      */

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_color_button')
      .on('click', function(e, d) { color_allele(alleles.indexOf(d)); })
      .attr('id', function(d, i) { return 'allele_color_button_'+String(i); })
      .html('C');

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_pos')
      .html(function(d) { return d.split('_')[1]; });

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele wt_allele')
      .on('click', function(e, d) { flip_allele(alleles.indexOf(d), '0'); })
      .attr('id', function(d, i) { return 'wt_allele_'+String(i); })
      .html(function(d) { return d.split('_')[0]; });

  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele new_allele')
      .on('click', function(e, d) { flip_allele(alleles.indexOf(d), '1'); })
      .attr('id', function(d, i) { return 'new_allele_'+String(i); })
      .html(function(d) { return d.split('_')[2]; });
  
  d3.selectAll('.allele_div')
    .append('div')
      .attr('class', 'allele_content allele_freq')
      .attr('id', function(d, i) { return 'allele_freq_'+String(i); })
      .html('');
}

function svg_diamond(x, y, size) {
  return String(x)+','+String(y-size)+' '+String(x-size)+','+String(y)+' '+String(x)+','+String(y+size)+' '+String(x+size)+','+String(y);
}

function setup_interaction() {
  update_hover_map();
  let hover_circles = [];
  for (let i=0; i<2; i++) {
    hover_circles.push(main_svg.append('circle')
      .attr('r', 5)
      .attr('cx', 100)
      .attr('cy', 100)
      .attr('fill', 'none')
      .attr('stroke', '#000000')
      .attr('opacity', 0));
    click_circles.push(main_svg.append('circle')
      .attr('r', 5)
      .attr('cx', 100)
      .attr('cy', 100)
      .attr('fill', 'none')
      .attr('stroke', '#FF0088')
      .attr('stroke-width', 2)
      .attr('opacity', 0));
  }
  /* old coloring of germline and somatic
  for (let v of Object.keys(color_variants)) {
    main_svg
      .append('polygon')
        .attr('points', svg_diamond(xs(data_by_variant[v]['fdl_x']), ys(data_by_variant[v]['fdl_y']), 6))
        .attr('fill', color_variants[v])
        .attr('stroke', 'none');
  }
  */
  
  main_svg.append('text')
    .attr('class', 'germ_som_text')
    .attr('dominant-baseline', 'hanging')
    .attr('x', xs(data_by_variant['00000000000']['fdl_x'])-15)
    .attr('y', 250)
    .style('inline-size', '100px')
    .html('Germline');

  main_svg.append('line')
    .attr('class', 'germ_som_line')
    .attr('stroke', '#555555')
    .attr('stroke-width', 1)
    .attr('x1', xs(data_by_variant['00000000000']['fdl_x'])-10)
    .attr('y1', 267)
    .attr('x2', xs(data_by_variant['00000000000']['fdl_x']))
    .attr('y2', ys(data_by_variant['00000000000']['fdl_y']));

  main_svg.append('text')
    .attr('class', 'germ_som_text')
    .attr('dominant-baseline', 'hanging')
    .attr('x', xs(data_by_variant['11111111111']['fdl_x'])+70)
    .attr('y', 343)
    .style('inline-size', '100px')
    .html('Somatic');

  main_svg.append('line')
    .attr('class', 'germ_som_line')
    .attr('stroke', '#555555')
    .attr('stroke-width', 1)
    .attr('x1', xs(data_by_variant['11111111111']['fdl_x'])+35)
    .attr('y1', 360)
    .attr('x2', xs(data_by_variant['11111111111']['fdl_x']))
    .attr('y2', ys(data_by_variant['11111111111']['fdl_y']));
  
  
  main_svg.on('mousemove', function(event, d) {
    let [mx, my] = d3.pointer(event, this);
    if ((mx < canvasWidth) && (my < canvasHeight)) {
      let hover_el = hoverMap[Math.round(mx)][Math.round(my)];
      if (hover_el) {
        if (hover_el['variant'] != 'none') {
          let v = hover_el['variant'];
          highlight_variant(v);
          hover_circles[0]
            .attr('cx', hover_el['point_location'][0])
            .attr('cy', hover_el['point_location'][1])
            .attr('fill', colorMap[hover_el['variant']].formatHex())
            .attr('opacity', 1);
          hover_circles[1]
            .attr('cx', data_by_variant[v]['kdx'])
            .attr('cy', data_by_variant[v]['kdy'])
            .attr('fill', colorMap[hover_el['variant']].formatHex())
            .attr('opacity', 1);
        } else {
          highlight_variant('none');
          hover_circles[0].attr('opacity', 0);
          hover_circles[1].attr('opacity', 0);
        }
      }
    }
  });
  main_svg.on('click', function(event, d) {
    main_svg.selectAll('.kd_curve_line').remove();
    let [mx, my] = d3.pointer(event, this);
    if ((mx < canvasWidth) && (my < canvasHeight)) {
      let hover_el = hoverMap[Math.round(mx)][Math.round(my)];
      if (hover_el) {
        if (hover_el['variant'] != 'none') {
          click_variant(hover_el['variant']);
        } else {
          highlight_variant('none');
          click_circles[0].attr('opacity', 0);
          click_circles[1].attr('opacity', 0);
        }
      } 
    }
  });
  //adding violin plot axis
  kd_axis = main_svg.append('g')
    .attr('id', 'kd_axis')
    .attr("transform", "translate(0,"+String(violin_y(1))+")").call(d3.axisBottom().scale(x_by_kd).ticks(4));
  main_svg.append('text')
    .attr('class', 'x_axis_label')
    .attr('x', x_by_kd(8.5))
    .attr('y', violin_y(1)+50)
    .html('-log10Kd');
  // adding brushing https://www.d3-graph-gallery.com/graph/interactivity_brush.html
  main_svg.call( d3.brush()                 // Add the brush feature using the d3.brush function
      .extent( [ [0,0], [canvasWidth,canvasHeight] ] ) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
      .on("start brush", function(event) { process_brush(event); }) // Each time the brush selection changes, trigger the 'process_brush' function
    )

  // adding bottom plot for kd curves
  //adding violin plot axis
  main_svg.append('g')
    .attr('class', 'kd_curve_axis')
    .attr("transform", "translate(0,"+String(kd_curve_y(2))+")").call(d3.axisBottom().scale(kd_curve_x).ticks(4));

  main_svg.append('g')
    .attr('class', 'kd_curve_axis')
    .attr("transform", "translate("+String(kd_curve_x(-15))+", 0)").call(d3.axisLeft().scale(kd_curve_y).ticks(4));

  main_svg.append('text')
    .attr('class', 'x_axis_label')
    .attr('x', kd_curve_x(-10))
    .attr('y', kd_curve_y(2)+50)
    .html('-log[HA], M');

  main_svg.append('text')
    .attr('id', 'kd_curve_title')
    .attr('class', 'x_axis_label')
    .attr('x', kd_curve_x(-10))
    .attr('y', kd_curve_y(5.3))
    .html('');

  main_svg.append('text')
    .attr('class', 'y_axis_label')
    .attr('x', kd_curve_x(-16.5))
    .attr('y', kd_curve_y(3.5))
    .html('mean');
  main_svg.append('text')
    .attr('class', 'y_axis_label')
    .attr('x', kd_curve_x(-16.5))
    .attr('y', kd_curve_y(2.5))
    .html('bin');

  d3.select('body').on('keydown', function(e) {
    if (['ArrowDown', 'ArrowRight'].indexOf(e.key)>-1) {
      iterate_over_points(1, e.shiftKey);
    } else if (['ArrowUp', 'ArrowLeft'].indexOf(e.key)>-1) {
      iterate_over_points(-1, e.shiftKey);
    }
  })
}


function get_violin_y(xpos, d) {
  if (!(d['geno_str'] in violin_y_pos_counter)) {
    violin_y_pos_counter[d['geno_str']] = [d['ypos_base'], {}];
  }
  let tmp_dict = violin_y_pos_counter[d['geno_str']][1];
  if (xpos in tmp_dict) {
    tmp_dict[xpos]++;
  } else {
    tmp_dict[xpos]=0;
  }
  return Math.round(d['ypos_base'] + ((tmp_dict[xpos] % 2)-0.5)*0.1*tmp_dict[xpos]);
}


function kd_for(kd_var_tmp) {
  kd_var = kd_var_tmp;
  if ((kd_var == 'H1') || (kd_var == 'H9')) {
    x_by_kd = d3.scaleLinear().domain([7,10]).range([630,790]);
    color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([7,10]);
  } else {
    x_by_kd = d3.scaleLinear().domain([6,9]).range([630,790]);
    color_by_kd = d3.scaleSequential(d3.interpolateViridis).domain([6,9]);
  }
  kd_axis.remove();
  kd_axis = main_svg.append('g')
    .attr('id', 'kd_axis')
    .attr("transform", "translate(0,"+String(violin_y(1))+")").call(d3.axisBottom().scale(x_by_kd).ticks(4));
  d3.selectAll('.antigen_button').classed('antigen_active', false);
  d3.select('#antigen_'+kd_var).classed('antigen_active', true);
  for (let d of main_data) {
    if (d[kd_var+'_log10Kd'] == '') { //if Kd is undefined, assume lower limit
      d['kdx'] = x_by_kd.range()[0];
    } else {
      d['kdx'] = Math.floor(x_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
    }
    d['kd_color'] = d3.color(color_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
  }
  color_data();
  draw_data();
  if (clicked_variant) plot_kd_curve(clicked_variant);
}

function setup_viz() {
  /*
  var stage = new NGL.Stage("yoda_ngl_viewer");
  stage.loadFile("rcsb://4FQI", {defaultRepresentation: true});
  stage.setParameters({
    backgroundColor: "white"
  });
  stage.mouseControls.remove("hoverPick");
  */

  canvas = document.getElementById("yoda_canvas");
  main_svg = d3.select("#yoda_svg");
  ctx = canvas.getContext("2d");
  canvasData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  let x_domain = d3.extent(main_data.map(d=>parseFloat(d.fdl_x)));
  let y_domain = d3.extent(main_data.map(d=>parseFloat(d.fdl_y)));
  let x_d_dif = x_domain[1]-x_domain[0];
  let y_d_dif = y_domain[1]-y_domain[0];
  if (x_d_dif > y_d_dif) {
    y_domain[0] = y_domain[0] - (x_d_dif-y_d_dif)/2 - x_d_dif/20; // first part makes scales equal (square), second is a buffer
    y_domain[1] = y_domain[1] + (x_d_dif-y_d_dif)/2 + x_d_dif/20;
    x_domain[0] = x_domain[0] - x_d_dif/20;
    x_domain[1] = x_domain[1] + x_d_dif/20;
  } else {
    y_domain[0] = y_domain[0] - y_d_dif/20;
    y_domain[1] = y_domain[1] + y_d_dif/20;
    x_domain[0] = x_domain[0] - (y_d_dif-x_d_dif)/2 - x_d_dif/20;
    x_domain[1] = x_domain[1] + (y_d_dif-x_d_dif)/2 + x_d_dif/20;
  }
  xs = d3.scaleLinear().domain(x_domain).range([0, 600]);
  ys = d3.scaleLinear().domain(y_domain).range([0, 600]);
  this.variants_count = main_data.length;
  for (let d of main_data) {
    data_by_variant[d['variant']] = d;
    d['geno_str'] = ''; //empty because no alleles are colored yet
    d['x_exact'] = xs(Number(d['fdl_x']));
    d['y_exact'] = ys(Number(d['fdl_y']));
    d['x'] = Math.floor(d['x_exact']); // TODO: make pixel interpretation technically correct
    d['y'] = Math.floor(d['y_exact']);
    if (d[kd_var+'_log10Kd'] == '') { //if Kd is undefined, assume lower limit
      d['kdx'] = x_by_kd.range()[0];
    } else {
      d['kdx'] = Math.floor(x_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
    }
    d['kd_color'] = d3.color(color_by_kd(Number(d[kd_var+'_log10Kd'])*-1));
  }
  setup_left_bar();
  color_data(first_time=true);
  draw_data();
  setup_interaction();
}

function read_files(fpath) {
  console.log('starting yoda viz...')
  d3.csv(fpath).then(function(data) {
    main_data = data;
    variants_in_selection = main_data.map(d => d.variant);
    use_data = main_data;
    console.log(data.slice(0,10));
    aq.loadArrow('/yoda_browser/data/Kd_data/6261_20210323_h1_all.arrow').then((td) => kd_data['H1']=td);
    aq.loadArrow('/yoda_browser/data/Kd_data/6261_20210323_h9_all.arrow').then((td) => kd_data['H9']=td);
    d3.select('#loading_message').style('display', 'none');
    setup_viz();
  });
}


function toggle_about() {
  let new_style = (d3.select('#yoda_about_div').style('display')=='none') ? 'block' : 'none';
  d3.select('#yoda_about_div').style('display', new_style);
}