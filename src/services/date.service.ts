import { /* inject, */ BindingScope, injectable} from '@loopback/core';

@injectable({scope: BindingScope.TRANSIENT})
export class DateService {
  constructor(/* Add @inject to inject parameters */) { }

  /*
   * Add service methods here
   */
  addMonths(date: Date, months: number, i?: number): Date {
    let date2 = new Date(date) //Prevent overwrite of date parameter
    let d = date2.getDate();
    date2.setMonth(date2.getMonth() + +months); //gets month from parameter, adds months param, then calls setMonth
    //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
    if (date2.getDate() != d) {
      date2.setDate(0);
    }
    return date2;
  }

  addUTCMonths(date: Date, months: number, i?: number): Date {
    let date2 = new Date(date) //Prevent overwrite of date parameter
    let d = date2.getUTCDate();
    date2.setUTCMonth(date2.getUTCMonth() + +months); //gets month from parameter, adds months param, then calls setMonth
    //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
    if (date2.getUTCDate() != d) {
      date2.setUTCDate(0);
    }
    return date2;
  }

  checkMonthGap(startDate: Date, endDate: Date): number {
    let d1 = new Date(startDate);
    let d2 = new Date(endDate);
    let months;
    months = (d1.getUTCFullYear() - d1.getUTCFullYear()) * 12;
    months -= d1.getUTCMonth();
    months += d2.getUTCMonth();
    return months <= 0 ? 0 : months;
  }

  checkWeekGap(startDate: Date, endDate: Date): number {
    let d1 = new Date(startDate);
    let d2 = new Date(endDate);
    d1.setUTCHours(0, 0, 0, 0)
    d2.setUTCDate(d2.getUTCDate() + 1)
    d2.setUTCHours(0, 0, 0, 0)
    let d1ms = d1.getTime()
    let d2ms = d2.getTime()
    return (d2ms - d1ms) / (7 * 24 * 60 * 60 * 1000);
  }

  isCalendarMonth(startDate: Date, endDate: Date): boolean {
    const lastDayOfMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const lastDayOfMonthLeapYear = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let isLeapYear = startDate.getUTCFullYear() % 4 == 0
    let startMonth = startDate.getUTCMonth();
    let endMonth = endDate.getUTCMonth();
    console.log('isLeapYear: ', isLeapYear);
    console.log('startMonth: ', startMonth)
    console.log('endMonth: ', endMonth)
    console.log('startDate: ', startDate.getUTCDate())
    console.log('endDate: ', endDate.getUTCDate())
    if (
      (startMonth == endMonth) &&
      (
        (!isLeapYear &&
          (startDate.getUTCDate() == 1 &&
            endDate.getUTCDate() == lastDayOfMonth[startMonth])
        ) ||
        (isLeapYear &&
          (startDate.getUTCDate() == 1 &&
            endDate.getUTCDate() == lastDayOfMonthLeapYear[startMonth])
        )
      )
    ) {
      return true
    }
    return false
  }
}
