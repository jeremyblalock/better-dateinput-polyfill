;

(function () {
  "use strict";

  var MAIN_CSS = "dateinput-picker{display:inline-block;vertical-align:bottom}dateinput-picker>object{width:21rem;max-height:calc(2.5rem*8);box-shadow:0 0 15px gray;background:white;position:absolute;opacity:1;-webkit-transform:translate3d(0,0,0);transform:translate3d(0,0,0);-webkit-transform-origin:0 0;transform-origin:0 0;transition:.1s ease-out}dateinput-picker[aria-hidden=true]>object{opacity:0;-webkit-transform:skew(-25deg) scaleX(.75);transform:skew(-25deg) scaleX(.75);visibility:hidden;height:0}dateinput-picker[aria-expanded=true]>object{max-height:calc(2.5rem + 3.75rem*3)}dateinput-picker+input{color:transparent!important;caret-color:transparent!important}dateinput-picker+input::selection{background:transparent}dateinput-picker+input::-moz-selection{background:transparent}";
  var PICKER_CSS = "body{font-family:Helvetica Neue,Helvetica,Arial,sans-serif;line-height:2.5rem;text-align:center;cursor:default;-webkit-user-select:none;-ms-user-select:none;user-select:none;margin:0;overflow:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}a{width:3rem;height:2.5rem;position:absolute;text-decoration:none;color:inherit}b{display:block;cursor:pointer}table{width:100%;table-layout:fixed;border-spacing:0;border-collapse:collapse;text-align:center;line-height:2.5rem}td,th{padding:0}thead{background:lightgray;font-size:smaller;font-weight:700}[aria-selected=false],[aria-disabled=true]{color:gray}[aria-selected=true]{box-shadow:inset 0 0 0 1px gray}a:hover,td:hover,[aria-disabled=true],[aria-selected=true]{background-color:whitesmoke}table+table{line-height:3.75rem;background:white;position:absolute;top:2.5rem;left:0;opacity:1;transition:.1s ease-out}table+table[aria-hidden=true]{visibility:hidden!important;opacity:0}";
  var HTML = DOM.get("documentElement");
  var DEVICE_TYPE = "orientation" in window ? "mobile" : "desktop";
  var CLICK_EVENT_TYPE = DEVICE_TYPE === "mobile" ? "touchend" : "mousedown";

  var INTL_SUPPORTED = function () {
    try {
      new Date().toLocaleString("i");
    } catch (err) {
      return err instanceof RangeError;
    }

    return false;
  }();

  var TYPE_SUPPORTED = function () {
    // use a stronger type support detection that handles old WebKit browsers:
    // http://www.quirksmode.org/blog/archives/2015/03/better_modern_i.html
    return DOM.create("<input type='date'>").value("_").value() !== "_";
  }();

  function ampm(pos, neg) {
    return HTML.lang === "en-US" ? pos : neg;
  }

  function formatLocalDate(date) {
    return [date.getFullYear(), ("0" + (date.getMonth() + 1)).slice(-2), ("0" + date.getDate()).slice(-2)].join("-");
  }

  function parseLocalDate(value) {
    var valueParts = value.split("-");
    var dateValue = new Date(valueParts[0], valueParts[1] - 1, valueParts[2]);
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  function repeat(times, fn) {
    if (typeof fn === "string") {
      return Array(times + 1).join(fn);
    } else {
      return Array.apply(null, Array(times)).map(fn).join("");
    }
  }

  function localeWeekday(index) {
    var date = new Date(Date.UTC(ampm(2001, 2002), 0, index));
    /* istanbul ignore else */

    if (INTL_SUPPORTED) {
      try {
        return date.toLocaleDateString(HTML.lang, {
          weekday: "short"
        });
      } catch (err) {}
    }

    return date.toUTCString().split(",")[0].slice(0, 2);
  }

  function localeMonth(index) {
    var date = new Date(Date.UTC(2010, index));
    /* istanbul ignore else */

    if (INTL_SUPPORTED) {
      try {
        return date.toLocaleDateString(HTML.lang, {
          month: "short"
        });
      } catch (err) {}
    }

    return date.toUTCString().split(" ")[2];
  }

  function localeMonthYear(month, year) {
    // set hours to '12' to fix Safari bug in Date#toLocaleString
    var date = new Date(year, month, 12);
    /* istanbul ignore else */

    if (INTL_SUPPORTED) {
      try {
        return date.toLocaleDateString(HTML.lang, {
          month: "long",
          year: "numeric"
        });
      } catch (err) {}
    }

    return date.toUTCString().split(" ").slice(2, 4).join(" ");
  }

  var PICKER_BODY_HTML = "<a style=\"left:0\">&#x25C4;</a> <a style=\"right:0\">&#x25BA;</a> <b></b><table><thead>" + repeat(7, function (_, i) {
    return "<th>" + localeWeekday(i);
  }) + "</thead><tbody>" + repeat(7, "<tr>" + repeat(7, "<td>") + "</tr>") + "</tbody></table><table><tbody>" + repeat(3, function (_, i) {
    return "<tr>" + repeat(4, function (_, j) {
      return "<td>" + localeMonth(i * 4 + j);
    });
  }) + "</tbody></table>";
  DOM.extend("input[type=date]", {
    constructor: function constructor() {
      var _this = this;

      if (this._isPolyfillEnabled()) return false;
      this._svgTextOptions = this.css(["color", "font", "padding-left", "border-left-width", "text-indent", "padding-top", "border-top-width"]);
      this._svgTextOptions.dx = ["padding-left", "border-left-width", "text-indent"].map(function (p) {
        return parseFloat(_this._svgTextOptions[p]);
      }).reduce(function (a, b) {
        return a + b;
      });
      this._svgTextOptions.dy = ["padding-top", "border-top-width"].map(function (p) {
        return parseFloat(_this._svgTextOptions[p]);
      }).reduce(function (a, b) {
        return a + b;
      }) / 2;
      var picker = DOM.create("<dateinput-picker tabindex='-1'>"); // store reference to the input

      picker._parentInput = this; // add <dateinput-picker> to the document

      this.before(picker.hide()); // store reference to the picker

      this._picker = picker;

      var resetDisplayedText = this._syncDisplayedText.bind(this, "defaultValue");

      var updateDisplayedText = this._syncDisplayedText.bind(this, "value"); // patch value property for the input element


      var valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      Object.defineProperty(this[0], "value", {
        configurable: false,
        enumerable: true,
        get: valueDescriptor.get,
        set: this._setValue.bind(this, valueDescriptor.set, updateDisplayedText)
      });
      Object.defineProperty(this[0], "valueAsDate", {
        configurable: false,
        enumerable: true,
        get: this._getValueAsDate.bind(this),
        set: this._setValueAsDate.bind(this)
      }); // sync picker visibility on focus/blur

      this.on("change", updateDisplayedText);
      this.on("focus", this._focusInput.bind(this));
      this.on("blur", this._blurInput.bind(this));
      this.on("keydown", ["which"], this._keydownInput.bind(this));
      this.on(CLICK_EVENT_TYPE, this._focusInput.bind(this)); // form events do not trigger any state change

      this.closest("form").on("reset", resetDisplayedText);
      resetDisplayedText(); // present initial value
    },
    _isPolyfillEnabled: function _isPolyfillEnabled() {
      var polyfillType = this.get("data-polyfill");
      if (polyfillType === "none") return true;

      if (polyfillType && (polyfillType === DEVICE_TYPE || polyfillType === "all")) {
        // remove native browser implementation
        this.set("type", "text"); // force applying the polyfill

        return false;
      }

      return TYPE_SUPPORTED;
    },
    _setValue: function _setValue(setter, updateDisplayedText, value) {
      var dateValue = parseLocalDate(value);

      if (!dateValue) {
        value = "";
      } else {
        var min = parseLocalDate(this.get("min")) || Number.MIN_VALUE;
        var max = parseLocalDate(this.get("max")) || Number.MAX_VALUE;

        if (dateValue < min) {
          value = formatLocalDate(min);
        } else if (dateValue > max) {
          value = formatLocalDate(max);
        }
      }

      setter.call(this[0], value);
      updateDisplayedText();
    },
    _getValueAsDate: function _getValueAsDate() {
      return parseLocalDate(this.value());
    },
    _setValueAsDate: function _setValueAsDate(dateValue) {
      if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
        this.value(formatLocalDate(dateValue));
      }
    },
    _syncDisplayedText: function _syncDisplayedText(propName) {
      var displayText = this.get(propName);
      var dateValue = parseLocalDate(displayText);

      if (dateValue) {
        if (INTL_SUPPORTED) {
          var formatOptions = this.get("data-format");

          try {
            // set hours to '12' to fix Safari bug in Date#toLocaleString
            displayText = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), 12).toLocaleDateString(HTML.lang, formatOptions ? JSON.parse(formatOptions) : {});
          } catch (err) {}
        }
      }

      this.css("background-image", "url('data:image/svg+xml," + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\"><text x=\"" + this._svgTextOptions.dx + "\" y=\"50%\" dy=\"" + this._svgTextOptions.dy + "\" fill=\"" + this._svgTextOptions.color + "\" style=\"font:" + this._svgTextOptions.font + "\">" + displayText + "</text></svg>") + "')");
    },
    _keydownInput: function _keydownInput(which) {
      if (which === 13 && this._picker.get("aria-hidden") === "true") {
        // ENTER key should submit form if calendar is hidden
        return true;
      }

      if (which === 32) {
        // SPACE key toggles calendar visibility
        if (!this.get("readonly")) {
          this._picker.toggleState(false);

          this._picker.invalidateState();

          if (this._picker.get("aria-hidden") === "true") {
            this._picker.show();
          } else {
            this._picker.hide();
          }
        }
      } else if (which === 27 || which === 9 || which === 13) {
        this._picker.hide(); // ESC, TAB or ENTER keys hide calendar

      } else if (which === 8 || which === 46) {
        this.empty().fire("change"); // BACKSPACE, DELETE clear value
      } else if (which === 17) {
        // CONTROL toggles calendar mode
        this._picker.toggleState();

        this._picker.invalidateState();
      } else {
        var delta;

        if (which === 74 || which === 40) {
          delta = 7;
        } else if (which === 75 || which === 38) {
          delta = -7;
        } else if (which === 76 || which === 39) {
          delta = 1;
        } else if (which === 72 || which === 37) {
          delta = -1;
        }

        if (delta) {
          var currentDate = this.get("valueAsDate") || new Date();
          var expanded = this._picker.get("aria-expanded") === "true";

          if (expanded && (which === 40 || which === 38)) {
            currentDate.setMonth(currentDate.getMonth() + (delta > 0 ? 4 : -4));
          } else if (expanded && (which === 37 || which === 39)) {
            currentDate.setMonth(currentDate.getMonth() + (delta > 0 ? 1 : -1));
          } else {
            currentDate.setDate(currentDate.getDate() + delta);
          }

          this.value(formatLocalDate(currentDate)).fire("change");
        }
      } // prevent default action except if it was TAB so
      // do not allow to change the value manually


      return which === 9;
    },
    _blurInput: function _blurInput() {
      this._picker.hide();
    },
    _focusInput: function _focusInput() {
      if (this.get("readonly")) return false;
      var offset = this.offset();

      var pickerOffset = this._picker.offset();

      var marginTop = offset.height; // #3: move calendar to the top when passing cross browser window bounds

      if (HTML.clientHeight < offset.bottom + pickerOffset.height) {
        marginTop = -pickerOffset.height;
      } // always reset picker mode to the default


      this._picker.toggleState(false);

      this._picker.invalidateState(); // always recalculate picker top position


      this._picker.css("margin-top", marginTop).show();
    }
  });
  DOM.extend("dateinput-picker", {
    constructor: function constructor() {
      var IE = "ScriptEngineMajorVersion" in window;
      var object = DOM.create("<object type='text/html' width='100%' height='100%'>"); // non-IE: must be BEFORE the element added to the document

      if (!IE) {
        object.set("data", "about:blank");
      } // load content when <object> is ready


      this.on("load", {
        capture: true,
        once: true
      }, ["target"], this._loadContent.bind(this)); // add object element to the document

      this.append(object); // IE: must be AFTER the element added to the document

      if (IE) {
        object.set("data", "about:blank");
      }
    },
    _loadContent: function _loadContent(object) {
      var pickerRoot = DOM.constructor(object.get("contentDocument"));
      var pickerBody = pickerRoot.find("body"); // initialize picker content

      pickerRoot.importStyles(PICKER_CSS);
      pickerBody.set(PICKER_BODY_HTML); // internal references

      this._calendarDays = pickerBody.find("table");
      this._calendarMonths = pickerBody.find("table+table");
      this._calendarCaption = pickerBody.find("b"); // picker invalidate handlers

      this._calendarDays.on("picker:invalidate", ["detail"], this._invalidateDays.bind(this));

      this._calendarMonths.on("picker:invalidate", ["detail"], this._invalidateMonths.bind(this));

      pickerBody.on("picker:invalidate", ["detail"], this._invalidateCaption.bind(this)); // picker click handlers

      pickerBody.on(CLICK_EVENT_TYPE, "a", ["target"], this._clickPickerButton.bind(this));
      pickerBody.on(CLICK_EVENT_TYPE, "td", ["target"], this._clickPickerDay.bind(this));

      this._calendarCaption.on(CLICK_EVENT_TYPE, this._clickCaption.bind(this));

      this._parentInput.on("change", this.invalidateState.bind(this)); // prevent input from loosing the focus outline


      pickerBody.on(CLICK_EVENT_TYPE, function () {
        return false;
      }); // display calendar for autofocused elements

      if (DOM.get("activeElement") === this._parentInput[0]) {
        this.show();
      }
    },
    _invalidateDays: function _invalidateDays(dateValue) {
      var month = dateValue.getMonth();
      var date = dateValue.getDate();
      var year = dateValue.getFullYear();
      var min = parseLocalDate(this._parentInput.get("min")) || Number.MIN_VALUE;
      var max = parseLocalDate(this._parentInput.get("max")) || Number.MAX_VALUE;
      var iterDate = new Date(year, month, 1); // move to beginning of the first week in current month

      iterDate.setDate(1 - iterDate.getDay() - ampm(1, iterDate.getDay() === 0 ? 7 : 0)); // update days picker

      this._calendarDays.findAll("td").forEach(function (day) {
        iterDate.setDate(iterDate.getDate() + 1);
        var mDiff = month - iterDate.getMonth(),
            selectedValue = null,
            disabledValue = null;
        if (year !== iterDate.getFullYear()) mDiff *= -1;

        if (iterDate < min || iterDate > max) {
          disabledValue = "true";
        } else if (mDiff > 0 || mDiff < 0) {
          selectedValue = "false";
        } else if (date === iterDate.getDate()) {
          selectedValue = "true";
        }

        day._ts = iterDate.getTime();
        day.set("aria-selected", selectedValue);
        day.set("aria-disabled", disabledValue);
        day.value(iterDate.getDate());
      });
    },
    _invalidateMonths: function _invalidateMonths(dateValue) {
      var month = dateValue.getMonth();
      var year = dateValue.getFullYear();
      var min = parseLocalDate(this._parentInput.get("min")) || Number.MIN_VALUE;
      var max = parseLocalDate(this._parentInput.get("max")) || Number.MAX_VALUE;
      var iterDate = new Date(year, month, 1);

      this._calendarMonths.findAll("td").forEach(function (day, index) {
        iterDate.setMonth(index);
        var mDiff = month - iterDate.getMonth(),
            selectedValue = null;

        if (iterDate < min || iterDate > max) {
          selectedValue = "false";
        } else if (!mDiff) {
          selectedValue = "true";
        }

        day._ts = iterDate.getTime();
        day.set("aria-selected", selectedValue);
      });
    },
    _invalidateCaption: function _invalidateCaption(dateValue) {
      var captionText = dateValue.getFullYear();

      if (this.get("aria-expanded") !== "true") {
        captionText = localeMonthYear(dateValue.getMonth(), captionText);
      } // update calendar caption


      this._calendarCaption.value(captionText);
    },
    _clickCaption: function _clickCaption() {
      this.toggleState();
      this.invalidateState();
    },
    _clickPickerButton: function _clickPickerButton(target) {
      var sign = target.next("a")[0] ? -1 : 1;
      var targetDate = this._parentInput.get("valueAsDate") || new Date();

      if (this.get("aria-expanded") === "true") {
        targetDate.setFullYear(targetDate.getFullYear() + sign);
      } else {
        targetDate.setMonth(targetDate.getMonth() + sign);
      }

      this._parentInput.value(formatLocalDate(targetDate)).fire("change");
    },
    _clickPickerDay: function _clickPickerDay(target) {
      var targetDate;

      if (this.get("aria-expanded") === "true") {
        if (isNaN(target._ts)) {
          targetDate = new Date();
        } else {
          targetDate = new Date(target._ts);
        } // switch to date calendar mode


        this.toggleState(false);
      } else {
        if (!isNaN(target._ts)) {
          targetDate = new Date(target._ts);
          this.hide();
        }
      }

      if (targetDate != null) {
        this._parentInput.value(formatLocalDate(targetDate)).fire("change");
      }
    },
    toggleState: function toggleState(expanded) {
      if (typeof expanded !== "boolean") {
        expanded = this.get("aria-expanded") !== "true";
      }

      this.set("aria-expanded", expanded);
    },
    invalidateState: function invalidateState() {
      var expanded = this.get("aria-expanded") === "true";
      var target = expanded ? this._calendarMonths : this._calendarDays;
      var dateValue = this._parentInput.get("valueAsDate") || new Date(); // refresh current picker

      target.fire("picker:invalidate", dateValue);

      if (expanded) {
        this._calendarMonths.show();
      } else {
        this._calendarMonths.hide();
      }
    }
  });
  DOM.importStyles(MAIN_CSS);
})();