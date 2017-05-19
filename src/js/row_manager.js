var RowManager = function(table){

	this.table = table;
	this.element = $("<div class='tabulator-tableHolder'></div>"); //containing element
	this.tableElement = $("<div class='tabulator-table'></div>"); //table element
	this.columnManager = null; //hold column manager object
	this.height = 0; //hold height of table element

	this.firstRender = false; //handle first render
	this.renderMode = "classic"; //current rendering mode

	this.rows = []; //hold row data objects
	this.activeRows = []; //rows currently available to on display in the table
	this.activeRowsCount = 0; //count of active rows

	this.displayRows = []; //rows currently on display in the table
	this.displayRowsCount = 0; //count of display rows

	this.scrollTop = 0;
	this.scrollLeft = 0;

	this.vDomRowHeight = 20; //approximation of row heights for padding

	this.vDomTop = 0; //hold position for first rendered row in the virtual DOM
	this.vDomBottom = 0; //hold possition for last rendered row in the virtual DOM

	this.vDomScrollPosTop = 0; //last scroll position of the vDom top;
	this.vDomScrollPosBottom = 0; //last scroll position of the vDom bottom;

	this.vDomTopPad = 0; //hold value of padding for top of virtual DOM
	this.vDomBottomPad = 0; //hold value of padding for bottom of virtual DOM

	this.vDomWindowBuffer = 0; //window row buffer before removing elements, to smooth scrolling


	this._initialize();
};

//////////////// Setup Functions /////////////////

//return containing element
RowManager.prototype.getElement = function(){
	return this.element;
};

//return table element
RowManager.prototype.getTableElement = function(){
	return this.tableElement;
};

//link to column manager
RowManager.prototype.setColumnManager = function(manager){
	this.columnManager = manager;
};

RowManager.prototype._initialize = function(){
	var self = this;

	//initialize manager
	self.element.append(self.tableElement);

	self.firstRender = true;

	//scroll header along with table body
	self.element.scroll(function(){
		var left = self.element.scrollLeft();


		//handle horizontal scrolling
		if(self.scrollLeft != left){
			self.columnManager.scrollHorizontal(left);
		}

		self.scrollLeft = left;
	});

	//handle virtual dom scrolling
	if(self.table.options.height && self.table.options.virtualDom){

		self.element.scroll(function(){
			var top = self.element.scrollTop();

			//handle verical scrolling
			if(self.scrollTop != top){
				self.scrollTop = top;
				self.scrollVertical();
			}else{
				self.scrollTop = top;
			}

		});
	}

};


////////////////// Row Manipulation //////////////////

RowManager.prototype.findRow = function(subject){
	var self = this;

	if(typeof subject == "object"){

		if(subject instanceof Row){
			//subject is row element
			return subject;
		}else if(subject instanceof jQuery){
			//subject is a jquery element of the row
			let match = self.rows.find(function(row){
				return row.element === subject;
			});

			return match || false;
		}else{
			//subject is public row object
			return subject._getSelf() || false;
		}

	}else{
		//subject should be treated as the index of the row
		let match = self.rows.find(function(row){
			return row.data[self.table.options.index] == subject;
		});

		return match || false;
	}

	//catch all for any other type of input

	return false;
};

RowManager.prototype.scrollToRow = function(row){
	var rowIndex;

	rowIndex = this.displayRows.indexOf(row);

	if(rowIndex > -1){

		switch(this.renderMode){
			case"classic":
			this.element.scrollTop(row.element.offset().top - this.element.offset().top + this.element.scrollTop());
			break;
			case"virtual":
			this._virtualRenderFill(rowIndex, true);
			break;
		}

	}else{
		console.warn("Scroll Error - Row not visible");
	}
};


////////////////// Data Handling //////////////////

RowManager.prototype.setData = function(data){
	var self = this;

	self.tabble.options.dataLoading(data);

	self.rows = [];

	data.forEach(function(def, i){
		var row = new Row(def, self);

		self.rows.push(row);
	});

	self.tabble.options.dataLoaded(data);

	self.refreshActiveData(true);
};

RowManager.prototype.deleteRow = function(row){
	var allIndex = this.rows.indexOf(row),
	activeIndex = this.activeRows.indexOf(row),
	displayIndex = this.displayRows.indexOf(row);

	if(displayIndex > -1){
		this.displayRows.splice(displayIndex, 1);
	}

	if(activeIndex > -1){
		this.activeRows.splice(activeIndex, 1);
	}

	if(allIndex > -1){
		this.rows.splice(allIndex, 1);
	}

	this.table.options.rowDeleted(row.getComponent());

	this.table.options.dataEdited(this.getData());

	this.setActiveRows(this.activeRows);

	this.setDisplayRows(this.displayRows);

	this.renderTable();
};

RowManager.prototype.addRow = function(data, pos, index){
	var row = new Row(data, this);
	var top = typeof pos == "undefined" ? this.table.options.addRowPos : pos;

	if(index){
		index = this.findRow(index);
	}

	if(top === "top"){
		top = true;
	}

	if(top === "bottom"){
		top = false;
	}

	if(index){
		let allIndex = this.rows.indexOf(index),
		activeIndex = this.activeRows.indexOf(index),
		displayIndex = this.displayRows.indexOf(index);

		if(displayIndex > -1){
			this.displayRows.splice((top ? displayIndex : displayIndex + 1), 0, row);
		}

		if(activeIndex > -1){
			this.activeRows.splice((top ? activeIndex : activeIndex + 1), 0, row);
		}

		if(allIndex > -1){
			this.rows.splice((top ? allIndex : allIndex + 1), 0, row);
		}

	}else{
		if(top){
			this.displayRows.unshift(row);
			this.activeRows.unshift(row);
			this.rows.unshift(row);
		}else{
			this.displayRows.push(row);
			this.activeRows.push(row);
			this.rows.push(row);
		}
	}

	this.setDisplayRows(this.displayRows)

	this.setActiveRows(this.activeRows);

	this.table.options.rowAdded(row.getComponent());

	this.table.options.dataEdited(this.getData);

	this.renderTable();

	return row;
};

RowManager.prototype.moveRow = function(from, to, after){
	this._moveRowInArray(this.rows, from, to, after);
	this._moveRowInArray(this.activeRows, from, to, after);
	this._moveRowInArray(this.displayRows, from, to, after);

	this.table.options.rowMoved(from.getComponent());
};

RowManager.prototype._moveRowInArray = function(rows, from, to, after){
	var	fromIndex = rows.indexOf(from),
	toIndex;

	if (fromIndex > -1) {

		rows.splice(fromIndex, 1);

		toIndex = rows.indexOf(to);

		if (toIndex > -1) {

			if(after){
				rows.splice(toIndex+1, 0, from);
			}else{
				rows.splice(toIndex, 0, from);
			}

		}else{
			rows.splice(fromIndex, 0, from);
		}
	}
};

RowManager.prototype.clearData = function(){
	this.setData([]);
};

RowManager.prototype.getData = function(active){
	var self = this,
	output = [];

	var rows = active ? self.rows : self.activeRows;

	rows.forEach(function(row){
		output.push(row.getData(true));
	});

	return output;
};


RowManager.prototype.getDataCount = function(active){
	return active ? this.rows.length : this.activeRows.length;
};

//set active data set
RowManager.prototype.refreshActiveData = function(dataChanged){
	var self = this,
	table = this.table;

	if(table.options.selectable && !table.options.selectablePersistence && table.extExists("selectRow")){
		table.extensions.selectRow.deselectRows();
	}


	//filter data
	if(table.extExists("filter")){
		if(table.extensions.filter.hasChanged() || dataChanged){
			self.setActiveRows(table.extensions.filter.filter(self.rows));

			dataChanged = true;
		}
	}else{
		self.setActiveRows(self.rows.slice(0));
	}

	//sort data
	if(table.extExists("sort")){
		if(table.extensions.sort.hasChanged() || dataChanged){
			table.extensions.sort.sort();

			dataChanged = true;
		}
	}

	//group data
	if(table.options.groupBy && table.extExists("groupRows")){
		self.setDisplayRows(table.extensions.groupRows.getRows(this.activeRows, dataChanged));

		if(table.options.pagination){
			console.warn("Invalid Setup Combination - Pagination and Row Grouping cannot be enabled at the same time");
		}
	}else{

		//paginate data
		if(table.options.pagination && table.extExists("page")){
			if(table.extensions.page.getMode() == "local"){
				if(dataChanged){
					table.extensions.page.reset();
				}
				table.extensions.page.setMaxRows(this.activeRows.length);
			}
			self.setDisplayRows(table.extensions.page.getRows(this.activeRows));
		}else{
			self.setDisplayRows(self.activeRows.slice(0));
		}
	}

	self.renderTable();

	if(!this.displayRowsCount){
		if(table.options.placeholder){
console.log("empty");
			self.getElement().append(table.options.placeholder);
		}
	}
};

RowManager.prototype.setActiveRows = function(activeRows){
	this.activeRows = activeRows;
	this.activeRowsCount = this.activeRows.length;
};

RowManager.prototype.setDisplayRows = function(displayRows){
	this.displayRows = displayRows;
	this.displayRowsCount = this.displayRows.length;
};

//return only actual rows (not group headers etc)
RowManager.prototype.getRows = function(){
	return this.rows;
};

///////////////// Table Rendering /////////////////

RowManager.prototype.renderTable = function(){
	var self = this;

	self.table.options.renderStarted();

	if(!self.height || !self.table.options.virtualDom || self.table.options.pagination){
		self.renderMode = "classic";
		self._simpleRender();
	}else{
		self.renderMode = "virtual";
		self._virtualRenderFill();
	}

	if(self.firstRender){

		if(self.displayRowsCount){
			self.firstRender = false;
			if(self.table.options.fitColumns){
				self.columnManager.fitToTable();
			}else{
				self.columnManager.fitToData();
			}

		}else{
			self.renderEmptyScroll();
		}

		if(self.table.options.responsiveLayout && self.table.extExists("responsiveLayout", true)){
			self.table.extensions.responsiveLayout.update();
		}
	}

	if(this.table.extExists("frozenColumns")){
		this.table.extensions.frozenColumns.layout();
	}

	self.table.options.renderComplete();
};

RowManager.prototype.getRenderMode = function(){
	return this.renderMode;
};

//simple render on heightless table
RowManager.prototype._simpleRender = function(){
	var element = this.tableElement;

	this._clearVirtualDom();

	if(this.displayRowsCount){
		this.displayRows.forEach(function(row){
			element.append(row.getElement());
			row.initialize();
		});
	}else{
		this.renderEmptyScroll();
	}
};

//show scrollbars on empty table div
RowManager.prototype.renderEmptyScroll = function(){
	var self = this;
	self.tableElement.css({
		"min-width":self.table.columnManager.getWidth(),
		"min-height":"1px",
		"visibility":"hidden",
	});
};

RowManager.prototype._clearVirtualDom = function(){
	var element = this.tableElement;

	if(this.table.options.placeholder){
		this.table.options.placeholder.detach();
	}

	element.empty();

	element.css({
		"padding-top":"",
		"padding-bottom":"",
		"min-width":"",
		"min-height":"",
		"visibility":"",
	});

	this.scrollTop = 0;
	this.scrollLeft = 0;
	this.vDomTop = 0;
	this.vDomBottom = 0;
	this.vDomTopPad = 0;
	this.vDomBottomPad = 0;
};

//full virtual render
RowManager.prototype._virtualRenderFill = function(position, forceMove){
	var self = this,
	element = self.tableElement,
	holder = self.element,
	topPad = 0,
	rowsHeight = 0,
	topPadHeight = 0,
	i = 0;

	position = position || 0;

	if(!position){
		self._clearVirtualDom();
	}else{

		element.empty();

		//check if position is too close to bottom of table
		let heightOccpied = (self.displayRowsCount - position) * self.vDomRowHeight

		if(heightOccpied < self.height){
			position -= Math.ceil((self.height - heightOccpied) / self.displayRowsCount);

			if(position < 0){
				position = 0;
			}
		}

		//calculate initial pad
		topPad = Math.min(Math.floor(self.vDomWindowBuffer / self.vDomRowHeight), position);
		position -= topPad;
	}

	if(self.displayRowsCount){

		this.vDomTop = position;

		self.vDomBottom = position -1;

		while (rowsHeight <= self.height + self.vDomWindowBuffer && self.vDomBottom < self.displayRowsCount -1){

			var row = self.displayRows[self.vDomBottom + 1]

			element.append(row.getElement());
			row.initialize();

			if(i < topPad){
				topPadHeight += row.getHeight();
			}else{
				rowsHeight += row.getHeight();
			}

			self.vDomBottom ++;
			i++;
		}

		if(!position){
			self.vDomRowHeight = self.displayRows[0].getHeight();
		}

		self.vDomTopPad = self.vDomRowHeight * this.vDomTop;

		self.vDomBottomPad = self.vDomRowHeight * (self.displayRowsCount - self.vDomBottom -1);

		element.css({
			"padding-top":self.vDomTopPad,
			"padding-bottom":self.vDomBottomPad,
		});

		// this.vDomScrollPosTop = this.scrollTop;
		// this.vDomScrollPosBottom = this.scrollTop;

		if(forceMove){
			this.scrollTop = self.vDomTopPad + (topPad * self.vDomRowHeight)

			this.vDomScrollPosTop = this.scrollTop;
			this.vDomScrollPosBottom = this.scrollTop;

			holder.scrollTop(this.scrollTop);
		}else{
			this.vDomScrollPosTop = this.scrollTop;
			this.vDomScrollPosBottom = this.scrollTop;
		}
	}else{
		this.renderEmptyScroll();
	}
};

//handle vertical scrolling
RowManager.prototype.scrollVertical = function(){
	var topDiff = this.scrollTop - this.vDomScrollPosTop;
	var bottomDiff = this.scrollTop - this.vDomScrollPosBottom;

	if(Math.abs(topDiff) > this.vDomWindowBuffer * 2 || Math.abs(bottomDiff) > this.vDomWindowBuffer){
		//if big scroll redraw table;
		this._virtualRenderFill(Math.floor((this.element.scrollTop() / this.element[0].scrollHeight) * this.displayRowsCount));
	}else{

		//handle top rows
		if(topDiff >= 0){
			//scrolling down
			this._removeTopRow(topDiff);
		}else{
			//scrolling up
			this._addTopRow(topDiff * -1)
		}

		//handle bottom rows
		if(bottomDiff >= 0){
			//scrolling down
			this._addBottomRow(bottomDiff);
		}else{
			//scrolling up
			this._removeBottomRow(bottomDiff * -1);
		}
	}

};

RowManager.prototype._addTopRow = function(topDiff){
	var table = this.tableElement;

	if(this.vDomTop){

		let topRow = this.displayRows[this.vDomTop -1];
		let topRowHeight = topRow.getHeight() || this.vDomRowHeight;

		//hide top row if needed
		if(topDiff >= topRowHeight){

			table.prepend(topRow.getElement());
			topRow.initialize();

			this.vDomTopPad -= topRowHeight;

			if(this.vDomTopPad < 0){
				this.vDomTopPad == (this.vDomTop -1) * this.vDomRowHeight;
			}

			table.css("padding-top", this.vDomTopPad);
			this.vDomScrollPosTop -= topRowHeight;
			this.vDomTop--;
		}

		topDiff = -(this.scrollTop - this.vDomScrollPosTop);

		if(this.vDomTop && topDiff >= (this.displayRows[this.vDomTop -1].getHeight() || this.vDomRowHeight)){
			this._addTopRow(topDiff);
		}

	}

};

RowManager.prototype._removeTopRow = function(topDiff){
	var table = this.tableElement,
	topRow = this.displayRows[this.vDomTop],
	topRowHeight = topRow.getHeight();

	//hide top row if needed
	if(this.scrollTop > this.vDomWindowBuffer){

		topRow.element.detach();

		this.vDomTopPad += topRowHeight;
		table.css("padding-top", this.vDomTopPad);
		this.vDomScrollPosTop += this.vDomTop ? topRowHeight : topRowHeight + this.vDomWindowBuffer;
		this.vDomTop++;

		topDiff = this.scrollTop - this.vDomScrollPosTop;

		if(topDiff >= (this.displayRows[this.vDomTop].getHeight() || this.vDomRowHeight)){
			this._removeTopRow(topDiff);
		}
	}

};

RowManager.prototype._addBottomRow = function(bottomDiff){
	var table = this.tableElement;

	if(this.vDomBottom < this.displayRowsCount -1){

		let bottomRow = this.displayRows[this.vDomBottom + 1];
		let bottomRowHeight = bottomRow.getHeight() || this.vDomRowHeight;

		//hide bottom row if needed
		if(bottomDiff >= bottomRowHeight){

			table.append(bottomRow.getElement());
			bottomRow.initialize();

			this.vDomBottomPad -= bottomRowHeight;

			if(this.vDomBottomPad < 0){
				this.vDomBottomPad == 0;
			}

			table.css("padding-bottom", this.vDomBottomPad);
			this.vDomScrollPosBottom += bottomRowHeight;
			this.vDomBottom++;
		}

		bottomDiff = this.scrollTop - this.vDomScrollPosBottom;

		if(this.vDomBottom < this.displayRowsCount -1 && bottomDiff >= (this.displayRows[this.vDomBottom + 1].getHeight() || this.vDomRowHeight)){
			this._addBottomRow(bottomDiff);
		}
	}
};

RowManager.prototype._removeBottomRow = function(bottomDiff){
	var table = this.tableElement,
	bottomRow = this.displayRows[this.vDomBottom],
	bottomRowHeight = bottomRow.getHeight() || this.vDomRowHeight;

	//hide bottom row if needed
	if(this.scrollTop < this.element.innerHeight() -this.element[0].scrollHeight - this.vDomWindowBuffer){

		bottomRow.element.detach();

		this.vDomBottomPad += bottomRowHeight;

		if(this.vDomBottomPad < 0){
			this.vDomBottomPad == 0;
		}

		table.css("padding-bottom", this.vDomBottomPad);
		this.vDomScrollPosBottom -= bottomRowHeight;
		this.vDomBottom--;

		bottomDiff = -(this.scrollTop - this.vDomScrollPosBottom);

		if(bottomDiff >= (this.displayRows[this.vDomBottom].getHeight() || this.vDomRowHeight)){
			this._removeBottomRow(bottomDiff);
		}
	}

};

//normalize height of active rows
RowManager.prototype.normalizeHeight = function(){
	var self = this;

	self.displayRows.forEach(function(row){
		row.normalizeHeight();
	});
};

//adjust the height of the table holder to fit in the Tabulator element
RowManager.prototype.adjustTableSize = function(){
	var self = this;

	if(self.table.options.height){

		let otherHeigt = self.columnManager.getElement().outerHeight() + (self.table.footerManager ? self.table.footerManager.getElement().outerHeight() : 0);

		self.element.css({
			"min-height":"calc(100% - " + otherHeigt + "px)",
			"height":"calc(100% - " + otherHeigt + "px)",
			"max-height":"calc(100% - " + otherHeigt + "px)",
		});

		self.height = self.element.innerHeight();
		self.vDomWindowBuffer = self.height;
	}
};

//renitialize all rows
RowManager.prototype.reinitialize = function(){
	this.rows.forEach(function(row){
		row.reinitialize();
	});
};