import { type ParamMap } from '@angular/router';
import { CalendarDate } from '@froment/contracts';
import { Schema } from 'effect';

export const readBillingPeriod = (params: ParamMap) => {
  const from = params.get('from');
  const to = params.get('to');
  return {
    from: Schema.is(CalendarDate)(from) ? from : '',
    to: Schema.is(CalendarDate)(to) ? to : '',
  };
};
