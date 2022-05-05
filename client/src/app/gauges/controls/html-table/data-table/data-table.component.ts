import { Component, OnInit, AfterViewInit, ViewChild, OnDestroy, Output, EventEmitter } from '@angular/core';
import { MatTable, MatTableDataSource, MatPaginator, MatSort, MatMenuTrigger } from '@angular/material';
import { Utils } from '../../../../_helpers/utils';
import { MatDialog } from '@angular/material';

import { TranslateService } from '@ngx-translate/core';

import { DaterangeDialogComponent } from '../../../../gui-helpers/daterange-dialog/daterange-dialog.component';
import { GaugeTableProperty, IDateRange, DaqQuery, TableType, TableOptions, TableColumn, TableRow, TableCellType, TableCell, TableRangeType } from '../../../../_models/hmi';
import { format } from 'fecha';

declare const numeral: any;
@Component({
    selector: 'app-data-table',
    templateUrl: './data-table.component.html',
    styleUrls: ['./data-table.component.css']
})
export class DataTableComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(MatTable) table: MatTable<any>;
    @ViewChild(MatSort) sort: MatSort;
    @ViewChild(MatMenuTrigger) trigger: MatMenuTrigger;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @Output() onTimeRange: EventEmitter<DaqQuery> = new EventEmitter();

    id: string;
    type: TableType;
    isEditor: boolean;
    displayedColumns = [];
    columnsStyle = {};
    dataSource = new MatTableDataSource([]);
    tagsMap = {};
    timestampMap = {};
    tagsColumnMap = {};
    range = { from: Date.now(), to: Date.now() };
    tableHistoryType = TableType.history;
    lastRangeType = TableRangeType;
    tableOptions = DataTableComponent.DefaultOptions();
    data = [];

    constructor(
        public dialog: MatDialog, 
        private translateService: TranslateService) { }

    ngOnInit() {
        this.dataSource.data = this.data;
        Object.keys(this.lastRangeType).forEach(key => {
            this.translateService.get(this.lastRangeType[key]).subscribe((txt: string) => { this.lastRangeType[key] = txt });
        });
    }

    ngAfterViewInit() {
        this.sort.disabled = this.type === TableType.data;
        this.bindTableControls();
    }

    ngOnDestroy() {
        try {
        } catch (e) {
            console.error(e);
        }
    }

    onRangeChanged(ev) {
        if (this.isEditor) {
            return;
        }
        if (ev) {
            this.range.from = Date.now();
            this.range.to = Date.now();
            this.range.from = new Date(this.range.from).setTime(new Date(this.range.from).getTime() - (TableRangeConverter.TableRangeToHours(ev) * 60 * 60 * 1000));

            let msg = new DaqQuery();
            msg.event = ev;
            msg.gid = this.id;
            msg.sids = Object.keys(this.tagsColumnMap);
            msg.from = this.range.from;
            msg.to = this.range.to;
            this.onTimeRange.emit(msg);
        }
    }

    onDateRange() {
        let dialogRef = this.dialog.open(DaterangeDialogComponent, {
            panelClass: 'light-dialog-container'
        });
        dialogRef.afterClosed().subscribe((dateRange: IDateRange) => {
            if (dateRange) {
                this.range.from = dateRange.start;
                this.range.to = dateRange.end;
                let msg = new DaqQuery();
                msg.gid = this.id;
                msg.sids = Object.keys(this.tagsColumnMap);
                msg.from = dateRange.start;
                msg.to = dateRange.end;
                this.onTimeRange.emit(msg);
            }
        });
    }  

    setOptions(options: TableOptions): void {
        this.tableOptions = { ...this.tableOptions, ...options };
        this.loadData();
        this.onRangeChanged(TableRangeType.last1h);
    }

    addValue(variableId: string, dt: number, variableValue: string) {
        if (this.tagsMap[variableId]) {
            this.tagsMap[variableId].value = variableValue;
            this.tagsMap[variableId].cells.forEach((cell: TableCellData) => {
                cell.stringValue = numeral(this.tagsMap[variableId].value).format(cell.valueFormat);
            });
            // update timestamp of all timestamp cells
            this.tagsMap[variableId].rows.forEach((rowIndex: number) => {
                if (this.timestampMap[rowIndex]) {
                    this.timestampMap[rowIndex].forEach((cell: TableCellData) => {
                        cell.stringValue = format(new Date(dt * 1e3), cell.valueFormat || 'YYYY-MM-DDTHH:mm:ss');
                    });
                }
            });
        }
    }

    public setValues(values) {
        // merge the data to have rows with 0:timestamp, n:variable values
        let data = [];
        // data.push({});
        data.push([]);    // timestamp, index 0
        let xmap = {};
        for (var i = 0; i < values.length; i++) {
            data.push([]);    // line
            for (var x = 0; x < values[i].length; x++) {
                let t = values[i][x].dt;
                if (!data[0][t]) {
                    data[0].push(t);
                    xmap[t] = {};
                }
                xmap[t][i] = values[i][x].value;
            }
        }
        data[0].sort(function (a, b) { return b - a });
        for (var i = 0; i < data[0].length; i++) {
            let t = data[0][i];
            for (var x = 1; x < data.length; x++) {
                if (xmap[t][x - 1] !== undefined) {
                    data[x].push(xmap[t][x - 1]);
                } else {
                    data[x].push(null);
                }
            }
        }
        // create the table data
        let dataTable = [];
        for (let i = 0; i < data[0].length; i++) {
            // create the row
            let row = {};
            for (let x = 0; x < this.displayedColumns.length; x++) {
                let column = <TableColumn>this.columnsStyle[this.displayedColumns[x]];
                row[column.id] = <TableCellData> { stringValue: '' };
                if (column.type === TableCellType.timestamp) {
                    row[column.id].stringValue = format(new Date(data[0][i]), column.valueFormat || 'YYYY-MM-DDTHH:mm:ss');
                } else if (column.type === TableCellType.variable) {
                    row[column.id].stringValue = (data[x][i]) ? numeral(data[x][i]).format(column.valueFormat) : '';
                } else if (column.type === TableCellType.device) {
                    row[column.id].stringValue = column.exname;
                }
            }
            dataTable.push(row);
        }



        // this.nguplot.setData(result);
        // this.nguplot.setXScala(this.range.from / 1e3, this.range.to / 1e3);
        this.dataSource.data = dataTable;
        this.bindTableControls();

    }

    applyFilter(filterValue: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
        this.dataSource.filter = filterValue;
    }
    
    private bindTableControls(): void {
        if (this.type === TableType.history && this.tableOptions.paginator.show) {
            this.dataSource.paginator = this.paginator;
        }
        this.dataSource.sort = this.sort;
    }

    private loadData() {
        // columns
        let columnIds = [];
        this.columnsStyle = {};
        this.tableOptions.columns.forEach(cn => {
            columnIds.push(cn.id);
            this.columnsStyle[cn.id] = cn;
            if (this.type === TableType.history) {
                if (cn.variableId) {
                    this.addColumnToMap(cn);
                }
            }
        })
        this.displayedColumns = columnIds;

        if (this.type === TableType.data) {
            // rows
            this.data = [];
            for (let i = 0; i < this.tableOptions.rows.length; i++) {
                let r = this.tableOptions.rows[i];
                let row = {};
                r.cells.forEach(cell => {
                    if (cell) {
                        row[cell.id] = <TableCellData> {stringValue: '', rowIndex: i, ...cell};
                        this.mapCellContent(row[cell.id]);
                    }
                });
                this.data.push(row);
            }
        }
        this.dataSource.data = this.data;
    }

    private mapCellContent(cell: TableCellData): void {
        cell.stringValue = '';
        if (cell.type === TableCellType.variable) {
            if (cell.variableId) {
                if (this.isEditor) {
                    cell.stringValue = numeral('123.56').format(cell.valueFormat);
                }                
                this.addVariableToMap(cell);
            }
        } else if (cell.type === TableCellType.timestamp) {
            if (this.isEditor) {
                cell.stringValue = format(new Date(0), cell.valueFormat || 'YYYY-MM-DDTHH:mm:ss');;
            }
            this.addTimestampToMap(cell);
        } else if (cell.type === TableCellType.label) {
            cell.stringValue = cell.label;
        } else if (cell.type === TableCellType.device) {
            cell.stringValue = cell.label;
        }
    }

    private addVariableToMap(cell: TableCellData) {
        if (!this.tagsMap[cell.variableId]) {
            this.tagsMap[cell.variableId] = <ITagMap>{ value: NaN, cells: [], rows: []};
        }
        this.tagsMap[cell.variableId].cells.push(cell);
        this.tagsMap[cell.variableId].rows.push(cell.rowIndex);
    }

    private addTimestampToMap(cell: TableCellData) {
        if (!this.timestampMap[cell.rowIndex]) {
            this.timestampMap[cell.rowIndex] = [];
        }
        this.timestampMap[cell.rowIndex].push(cell);
    }

    private addColumnToMap(cell: TableColumn) {
        if (!this.tagsColumnMap[cell.variableId]) {
            this.tagsColumnMap[cell.variableId] = [];
        }
        this.tagsColumnMap[cell.variableId].push(cell);
    }

    public static DefaultOptions() {
        let options = <TableOptions> { 
            paginator: { 
                show: false 
            },
            filter: { 
                show: false 
            },
            daterange: { 
                show: false 
            },            
            lastRange: Utils.getEnumKey(TableRangeType, TableRangeType.last1h),
            gridColor: '#E0E0E0',
            header: { 
                show: true,
                height: 30, 
                fontSize: 12,
                background: '#F0F0F0',
                color: '#757575',
            }, 
            row: { 
                height: 30, 
                fontSize: 10,
                background: '#F9F9F9',
                color: '#000000',
            },
            columns: [new TableColumn(Utils.getShortGUID('c_'), TableCellType.timestamp, 'Date/Time'), new TableColumn(Utils.getShortGUID('c_'), TableCellType.label, 'Tags')],
            rows: [],
        };
        return options;
    }
}

export class TableCellData extends TableCell {
    rowIndex: number;
    stringValue: string;
}

interface ITagMap {
    value: number;
    cells: TableCellData[];
    rows: number[];
}


export class TableRangeConverter {
    static TableRangeToHours (crt: TableRangeType) {
        let types = Object.keys(TableRangeType);
        if (crt === types[0]) {         // TableRangeType.last1h) {
            return 1;
        } else if (crt === types[1]) {  // TableRangeType.last1d) {
            return 24;
        } else if (crt === types[2]) {  // TableRangeType.last3d) {
            return 24 * 3; 
        }
        return 0;
    }
}

// interface IRowDateTime {
//     rowsIndex: number[];
//     lastDateTime: string;
// }