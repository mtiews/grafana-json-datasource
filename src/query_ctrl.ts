import { QueryCtrl } from 'grafana/app/plugins/sdk';

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  public types: object[];
  public showJSON: boolean;

  scope: any; // for angular

  constructor($scope: any, $injector: any)  {
    super($scope, $injector);

    this.target.hide = false;
    this.target.target = this.target.target || 'select metric';
    if (!this.target.type) {
      this.target.type = this.panelCtrl.panel.type === 'table' ? 'table' : 'timeseries';
    }
    this.target.data = this.target.data || '';

    this.types = [
      { text: 'Time series', value: 'timeseries' },
      { text: 'Table', value: 'table' },
    ];
    this.showJSON = false;
  }

  getOptions(query: any) {
    return this.datasource.metricFindQuery(query || '');
  }

  // not used
  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}
