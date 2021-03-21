/**
 * Ruler Control for MapboxGL
 * Stolen from: https://raw.githubusercontent.com/bravecow/mapbox-gl-controls/master/src/ruler/ruler.js
 * Modified to be more leightweight and suit my needs
 */

import mapboxgl from 'mapbox-gl'
import getDistance from 'geolib/es/getDistance'
import iconRuler from './icon-ruler.svg'

const LAYER_LINE = 'controls-layer-line'
const SOURCE_LINE = 'controls-source-line'
const MAIN_COLOR = '#263238'
const HALO_COLOR = '#fff'
const HALO1_COLOR = '#0f0'

function geoLineString (coordinates = []) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates
    }
  }
}

function defaultLabelFormat (delta, sum, units) {
  return `+ ${delta.toFixed(2)} ${units}<br/>= ${sum.toFixed(2)} ${units}`
}

export default class RulerControl {
  constructor (options = {}) {
    this.isMeasuring = false
    this.enabled = true
    this.markers = []
    this.coordinates = []
    this.labels = []
    this.units = options.units || 'km'
    this.font = options.font || ['Noto Sans Regular']
    this.fontSize = options.fontSize || 12
    this.fontHalo = options.fontHalo || 1
    this.labelFormat = options.labelFormat || defaultLabelFormat
    this.mainColor = options.mainColor || MAIN_COLOR
    this.secondaryColor = options.secondaryColor || HALO_COLOR
    this.altColor = options.altColor || HALO1_COLOR
    this.mapClickListener = this.mapClickListener.bind(this)
    this.styleLoadListener = this.styleLoadListener.bind(this)
  }

  insertControls () {
    this.container = document.createElement('div')
    this.container.classList.add('mapboxgl-ctrl')
    this.container.classList.add('mapboxgl-ctrl-group')
    this.container.classList.add('mapboxgl-ctrl-ruler')
    this.button = document.createElement('button')
    this.button.setAttribute('type', 'button')
    const img = document.createElement('img')
    img.src = iconRuler
    this.button.appendChild(img)
    this.container.appendChild(this.button)
  }

  setUnits (units) {
    this.units = units
  }

  draw () {
    this.map.addSource(SOURCE_LINE, {
      type: 'geojson',
      data: geoLineString(this.coordinates)
    })

    this.map.addLayer({
      id: LAYER_LINE,
      type: 'line',
      source: SOURCE_LINE,
      paint: {
        'line-color': this.mainColor,
        'line-width': 2
      }
    })
  }

  measuringOn () {
    this.isMeasuring = true
    this.markers = []
    this.coordinates = []
    this.labels = []
    this.map.getCanvas().style.cursor = 'crosshair'
    this.button.classList.add('active')
    this.draw()
    this.map.on('click', this.mapClickListener)
    this.map.on('style.load', this.styleLoadListener)
    this.map.fire('ruler.on')
  }

  measuringOff () {
    this.isMeasuring = false
    this.map.getCanvas().style.cursor = ''
    this.button.classList.remove('active')
    if (this.map.getLayer(LAYER_LINE)) this.map.removeLayer(LAYER_LINE)
    if (this.map.getSource(SOURCE_LINE)) this.map.removeSource(SOURCE_LINE)
    this.markers.forEach((m) => m.remove())
    this.map.off('click', this.mapClickListener)
    this.map.off('style.load', this.styleLoadListener)
    this.map.fire('ruler.off')
  }

  enable () {
    this.enabled = true
    this.button.classList.remove('disabled')
  }

  disable () {
    this.enabled = false
    this.measuringOff()
    this.button.classList.add('disabled')
  }

  mapClickListener (event) {
    const markerNode = document.createElement('div')
    markerNode.style.width = '12px'
    markerNode.style.height = '12px'
    markerNode.style.borderRadius = '50%'
    markerNode.style.background = this.markers.length === 0 ? this.altColor : this.secondaryColor
    markerNode.style.boxSizing = 'border-box'
    markerNode.style.border = `2px solid ${this.mainColor}`
    const marker = new mapboxgl.Marker({
      element: markerNode,
      draggable: true
    })
      .setLngLat(event.lngLat)
      .addTo(this.map)
    this.coordinates.push([event.lngLat.lng, event.lngLat.lat])
    this.map.getSource(SOURCE_LINE).setData(geoLineString(this.coordinates))
    this.markers.push(marker)
    if (this.markers.length > 1) {
      this.labels = this.coordinatesToLabels()
      marker.setPopup(new mapboxgl.Popup({ closeButton: false, closeOnClick: false }))
      marker.togglePopup()
      marker.getPopup().setHTML(this.labels[this.markers.length - 1])
    }
    marker.on('drag', () => {
      const index = this.markers.indexOf(marker)
      const lngLat = marker.getLngLat()
      this.coordinates[index] = [lngLat.lng, lngLat.lat]
      this.labels = this.coordinatesToLabels()
      this.labels.forEach((l, i) => {
        const popup = this.markers[i].getPopup()
        if (popup) popup.setHTML(l)
      })
      this.map.getSource(SOURCE_LINE).setData(geoLineString(this.coordinates))
    })
  }

  coordinatesToLabels () {
    const { coordinates, units, labelFormat } = this
    let sum = 0
    return coordinates.map((coordinate, index) => {
      if (index === 0) return labelFormat(0, 0, units)
      let delta = getDistance({
        latitude: coordinates[index - 1][1],
        longitude: coordinates[index - 1][0]
      }, {
        latitude: coordinates[index][1],
        longitude: coordinates[index][0]
      }) / 1000
      if (units === 'mi') {
        delta = delta * 0.621371
      } else if (units === 'nmi') {
        delta = delta * 0.539957
      }
      sum += delta
      return labelFormat(delta, sum, units)
    })
  }

  styleLoadListener () {
    this.draw()
  }

  onButtonClick () {
    if (!this.enabled) return
    if (this.isMeasuring) this.measuringOff()
    else this.measuringOn()
    this.map.fire('ruler.buttonclick', { measuring: this.isMeasuring })
  }

  onAdd (map) {
    this.map = map
    this.insertControls()
    this.button.addEventListener('click', this.onButtonClick.bind(this))
    return this.container
  }

  onRemove () {
    if (this.isMeasuring) {
      this.measuringOff()
    }
    this.button.removeEventListener('click', this.onButtonClick.bind(this))
    this.map.off('click', this.mapClickListener)
    this.container.parentNode.removeChild(this.container)
    this.map = undefined
  }
}
