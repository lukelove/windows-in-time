import { DateTime, Duration, Interval } from "luxon";
var _ = require('lodash');
var SunCalc = require('suncalc');
import Cookies from "js-cookie";


class CelestialInterval {
  constructor(interval){
    this.interval = interval
    this.time_string = this.interval.start.toLocaleString(DateTime.TIME_24_SIMPLE ) + " - " + this.interval.end.toLocaleString(DateTime.TIME_24_SIMPLE )
  }
}


class SunMagic {
  constructor(sunrise){
    this.sunrise = sunrise
    this.createIntervals(sunrise)
  }

  createIntervals(interval_start){
    var loopCount = 0

    this.intervals = _.map(_.times(5 * 12), (n) => {
      var element = ['spirit', 'air', 'fire', 'earth', 'water'][loopCount]
      if(loopCount == 4) { loopCount = 0 } else { loopCount+=1 } // this gives us access to know which element it is

      return new SunInterval(
        Interval.fromDateTimes(interval_start, ( interval_start = interval_start.plus({minutes: 24}) )),
        element, this.planetsIRule(element)
      )

    })
  }

  planetsIRule(element)  {
    switch (element) {
      case 'fire':
        return ['sun', 'mars']
      case 'water':
        return ['mercury', 'saturn']
      case 'air':
        return ['venus', 'jupiter']
      case 'earth':
        return ['moon', 'fixed stars']
      case 'spirit':
        return []
    }
  }

}

class MoonInterval extends CelestialInterval {
  constructor(interval, element, planet){
    // Chain constructor with super
    super(interval)
    this.element = element
    this.planet = planet
    this.elements = _.concat(this.element, this.planet)
  }
}

class MoonMagic {
  constructor(sunrise, sunset){

    var wholeDayMs = 86400000
    var dayMS = sunrise.diff(sunset).milliseconds * -1
    var nightMS = wholeDayMs - dayMS
    this.sunshineHourLengthInMS = parseInt(dayMS/12) // milliseconds
    this.moonlightHourLengthInMS = parseInt(nightMS/12) // milliseconds

    this.sunshineIntervals = this.createInterval(0, sunrise, this.firstPlanetOfTheDay(sunrise), this.sunshineHourLengthInMS)
    this.moonlightIntervals = this.createInterval(12, sunset, this.nextPlanet(_.last(this.sunshineIntervals).planet), this.moonlightHourLengthInMS) 
    this.intervals = _.concat( this.sunshineIntervals, this.moonlightIntervals )
  }

  planets() { return ['moon', 'saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury'] }

  firstPlanetOfTheDay(sunrise){
    var planet_days = ['moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'sun']
    return planet_days[ parseInt( sunrise.toFormat('c') ) - 1 ]
  }

  planetToElement(planet){
    switch (planet) {
      case 'sun':
      case 'mars':
        return 'fire'
      case 'mercury':
      case 'saturn':
        return 'water'
      case 'venus':
      case 'jupiter':
        return 'air'
      case 'moon':
        return 'earth'
    }
  }

  nextPlanet(planet){
    var currentIndex = this.planets().indexOf(planet)
    var nextIndex = currentIndex + 1

    return ( this.planets()[nextIndex] == undefined ) ? this.planets()[0] : this.planets()[nextIndex]
  }

  createInterval(indexOffset, time, intervalPlanet, intervalLength) {
    var loopCount = 0
    var owner = (indexOffset == 0) ? 'sun' : 'moon'

    return _.map(_.times(12), (n) => {
      var planet = intervalPlanet
      intervalPlanet = this.nextPlanet(intervalPlanet)

      return new MoonInterval(
        Interval.fromDateTimes(time, ( time = time.plus({millisecond: intervalLength}) )),
        this.planetToElement(planet),
        planet
      )

    })
  }


}

class SunInterval extends CelestialInterval {
  constructor(interval, element, planets){
    // Chain constructor with super
    super(interval)
    this.element = element
    this.planets = planets
    this.elements = _.concat(this.element, this.planets)
  }
}

class Earth {
  constructor(lat, lng){
    this.lat = lat
    this.lng = lng
  }

  async setTimes(date) {
    var dateFormat = 'yyyy MM dd'
    this.day = date
    this.isToday = date.toFormat(dateFormat) == DateTime.now().toFormat(dateFormat)
    var sunrise = this.sunrise(date)
    var days = Cookies.getJSON('days')
    // Cookies.remove('days')
    if( days ){
      var cookie_day = _.find( Cookies.getJSON('days'), (d) => { return DateTime.fromISO( d.sunrise ).toFormat(dateFormat) == date.toFormat(dateFormat) })
      if( cookie_day ){
        this.sunrise = DateTime.fromISO(cookie_day.sunrise)
        this.sunset = DateTime.fromISO(cookie_day.sunset)
        return
      }
    }

    console.log('no cookies found')

    // No cookies found, go get the data and set the cookies
    var url = ['https://api.sunrise-sunset.org/json?lat=', this.lat, '&lng=', this.lng, '&date=', sunrise.toISODate(),'&formatted=0'].join('')
    await fetch( url ).then(response => response.json()) .then((data) => { 
      days = (days == undefined) ? [] : days
      // console.log('days', days)
      Cookies.remove('days')
      days.push( {sunrise: data.results.sunrise.toString(), sunset: data.results.sunset.toString()} )
      Cookies.set('days', days)

      this.sunrise = DateTime.fromISO(data.results.sunrise)
      this.sunset = DateTime.fromISO(data.results.sunset)
      return
    })

  }

  sunrise(date){
 
    // if now is after sunrise, use today
    // if now is before sunrise, use yesterday

    var times = SunCalc.getTimes(date.toJSDate(), this.lat, this.lng);
    // console.log('times', times, this.lat, this.lng)
    var sunrise = DateTime.fromISO(times.sunrise.toISOString())

    // if( DateTime.now() < sunrise ){
    //   console.log("using Yesterday's Sunrise")
    //   date = date.plus({days: 1})
    //   times = SunCalc.getTimes(date.toJSDate(), this.lat, this.lng);
    //   sunrise = DateTime.fromISO(times.sunrise.toISOString())
    // }

    this.daily_ruler = this.dailyRuler(parseInt(sunrise.toFormat('c')))

    return sunrise
  }

  dailyRuler(day_of_week){ // 1-7
    return ['moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'sun'][day_of_week - 1]
  }

}

class WindowMagic {
  constructor(parent){
    parent.sun.intervals
    parent.moon.intervals
    this.createIntervals(parent)
  }

  createIntervals(parent){
    var windows = _.map(parent.moon.intervals, (moonI) => {
      var sunIntervals = _.filter(parent.sun.intervals, (sunI) => {
        
        if( _.intersection(moonI.elements, sunI.elements ).length == 0 ) return
        return sunI.interval.overlaps(moonI.interval)

      })

      return { moonInterval: moonI, sunIntervals: sunIntervals }
    })

    windows = _.filter(windows, (overlap) => { return overlap.sunIntervals.length > 0 })
    windows = _.map( windows, (window) => {
      return _.map(window.sunIntervals, (sunInterval) => {
        return new TimeWindow( window.moonInterval, sunInterval, parent.earth.daily_ruler )
      })
    })

    this.intervals = _.flatten(windows)
  }

}

class TimeWindow {
  constructor(moonInterval, sunInterval, dailyRuler){
    // this.moonInterval = moonInterval
    // this.sunInterval = sunInterval
    this.element = sunInterval.element
    this.planet = moonInterval.planet
    this.interval = moonInterval.interval.intersection(sunInterval.interval)
    this.golden = _.intersection(sunInterval.elements, [dailyRuler]).length == 1 && this.planet == dailyRuler
  }
}

class WindowsInTime {
  constructor(lat, lng){
    this.earth = new Earth(lat, lng)
  }

  magic() {
    this.sun = new SunMagic(this.earth.sunrise)
    this.moon = new MoonMagic(this.earth.sunrise, this.earth.sunset)
    this.windows = new WindowMagic(this)
  }
  
}

export {WindowsInTime};
