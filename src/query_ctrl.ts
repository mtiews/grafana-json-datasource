import angular from 'angular';
import map from 'lodash/map';
import each from 'lodash/each';
import { QueryCtrl } from 'grafana/app/plugins/sdk';

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  private types: any;
  private showJSON: boolean;
  whereSegments: any[];
  removeWhereFilterSegment: any;

  /** @ngInject **/
  constructor(
    $scope,
    $injector,
    private $q,
    private templateSrv,
    private uiSegmentSrv
  ) {
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
    this.target.wheres = this.target.wheres || [];

    this.whereSegments = [];
    for (const where of this.target.wheres) {
      if (!where.operator) {
          where.operator = '=';
      }

      if (where.condition) {
        this.whereSegments.push(uiSegmentSrv.newCondition(where.condition));
      }

      this.whereSegments.push(uiSegmentSrv.newKey(where.key));
      this.whereSegments.push(uiSegmentSrv.newOperator(where.operator));
      this.whereSegments.push(uiSegmentSrv.newKeyValue(where.value));
    }

    this.fixWhereSegments();
    this.removeWhereFilterSegment = uiSegmentSrv.newSegment({
      fake: true,
      value: '-- remove tag filter --',
    });
  }

  fixWhereSegments() {
    const count = this.whereSegments.length;
    const lastSegment = this.whereSegments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  findMetrics(query: string) {
    return this.datasource.findMetricsQuery(query, this.target.type);
  }

  getWhereSegments(segment: { type: string }, index: number) {
    if (segment.type === 'condition') {
      return this.$q.when([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
    }
    
    if (segment.type === 'operator') {
      return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', 'like', 'not like', 'in', 'not in']));
    }

    if (segment.type === 'key' || segment.type === 'plus-button') {
      return this.datasource.getTagKeys({ 'metric': this.target.target })
        .then(this.transformToSegments(false))
        .then((results: any) => {
          if (segment.type === 'key') {
            results.splice(0, 0, angular.copy(this.removeWhereFilterSegment));
          }
          return results;
        })
        .catch(this.handleQueryError.bind(this));
    } else if (segment.type === 'value') {
      return this.datasource.getTagValues({ 'metric': this.target.target, 'key': this.whereSegments[index - 2].value})
        .then(this.transformToSegments(true))
        .catch(this.handleQueryError.bind(this));
    }
  }

  transformToSegments(addTemplateVars: any) {
    return (results: any) => {
      const segments = map(results, segment => {
        return this.uiSegmentSrv.newSegment({
          value: segment.text,
          expandable: true,
        });
      });

      if (addTemplateVars) {
        for (const variable of this.templateSrv.variables) {
          //console.log(JSON.stringify(variable));
          if(variable.type !== 'adhoc') {
            segments.unshift(
              this.uiSegmentSrv.newSegment({
                type: 'value',
                value: '$' + variable.name,
                expandable: true,
              })
            );
          }
        }
      }

      return segments;
    };
  }

  whereSegmentUpdated(segment: { value: any; type: string; cssClass: string }, index: number) {
    this.whereSegments[index] = segment;

    // handle remove tag condition
    if (segment.value === this.removeWhereFilterSegment.value) {
      this.whereSegments.splice(index, 3);
      if (this.whereSegments.length === 0) {
        this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
      } else if (this.whereSegments.length > 2) {
        this.whereSegments.splice(Math.max(index - 1, 0), 1);
        if (this.whereSegments[this.whereSegments.length - 1].type !== 'plus-button') {
          this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
        }
      }
    } else {
      if (segment.type === 'plus-button') {
        if (index > 2) {
          this.whereSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
        this.whereSegments.push(this.uiSegmentSrv.newOperator('='));
        this.whereSegments.push(this.uiSegmentSrv.newFake('select value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      if (index + 1 === this.whereSegments.length) {
        this.whereSegments.push(this.uiSegmentSrv.newPlusButton());
      }
    }

    this.rebuildTargetWhereConditions();
  }

  rebuildTargetWhereConditions() {
    const wheres: any[] = [];
    let whereIndex = 0;
    let tagOperator = '';

    each(this.whereSegments, (segment, index) => {
      if (segment.type === 'key') {
        if (wheres.length === 0) {
          wheres.push({});
        }
        wheres[whereIndex].key = segment.value;
      } else if (segment.type === 'value') {
        wheres[whereIndex].value = segment.value;
      } else if (segment.type === 'condition') {
        wheres.push({ condition: segment.value });
        whereIndex += 1;
      } else if (segment.type === 'operator') {
        wheres[whereIndex].operator = segment.value;
      }
    });

    this.target.wheres = wheres;
    this.panelCtrl.refresh();
  }
  
  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }

  handleQueryError(err: any): any[] {
    this.error = err.message || 'Query failed';
    return [];
  }
}
