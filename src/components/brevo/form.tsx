'use client'

import { useTranslations } from 'next-intl'
import Script from 'next/script'

export default function BrevoForm() {
  const t = useTranslations('brevoForm')

  return (
    <>
      {/* Styles (Recommended to be in <head>, but placed here for component encapsulation) */}
      {/* External stylesheet removed to prevent font loading errors */}
      {/* Complete Brevo form styles with font blocking */}
      <style jsx>{`
        @font-face {
          font-family: 'Inter';
          src:
            url('data:,') format('woff2'),
            url('data:,') format('woff'),
            local('Inter'),
            local('system-ui');
          font-weight: 100 900;
          font-style: normal;
          font-display: swap;
        }

        /* Base form styling */
        .sib-form {
          text-align: center;
          font-family: Inter, system-ui, sans-serif !important;
        }

        #sib-container {
          text-align: center;
          direction: ltr;
          width: 100%;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .sib-form-block {
          padding: 8px 0;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .entry__label {
          font-weight: 700;
          text-align: left;
          font-size: 16px;
          color: #3c4858;
          font-family: Inter, system-ui, sans-serif !important;
          display: block;
          margin-bottom: 8px;
        }

        .input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          font-family: Inter, system-ui, sans-serif !important;
          box-sizing: border-box;
        }

        .input:focus {
          outline: none;
          border-color: #2bb2fc;
          box-shadow: 0 0 0 2px rgba(43, 178, 252, 0.2);
        }

        .entry__error {
          display: none;
          font-size: 14px;
          color: #661d1d;
          background-color: #ffeded;
          padding: 8px;
          border-radius: 3px;
          border: 1px solid #ff4949;
          margin-top: 4px;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .entry__specification {
          font-size: 12px;
          color: #8390a4;
          margin-top: 4px;
          display: block;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .sib-form-message-panel {
          padding: 16px;
          margin: 16px 0;
          border-radius: 4px;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .entry__field {
          width: 100%;
        }

        .form__entry {
          margin-bottom: 16px;
        }

        .sib-sms-input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sib-sms-tooltip {
          position: relative;
          display: inline-block;
        }

        .sib-sms-tooltip__icon {
          display: inline-block;
          width: 20px;
          height: 20px;
          background-color: #2bb2fc;
          color: white;
          border-radius: 50%;
          text-align: center;
          line-height: 20px;
          font-size: 12px;
          cursor: help;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .sib-sms-tooltip__box {
          visibility: hidden;
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 1;
          font-family: Inter, system-ui, sans-serif !important;
        }

        .sib-sms-tooltip:hover .sib-sms-tooltip__box {
          visibility: visible;
        }

        /* Force all elements to use system fonts */
        #sib-container,
        #sib-container *,
        .sib-form,
        .sib-form *,
        .sib-form-block,
        .sib-form-block *,
        .entry__label,
        .input,
        input[type='text'],
        input[type='email'],
        input[type='tel'],
        button {
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            Roboto,
            'Helvetica Neue',
            Arial,
            sans-serif !important;
        }
      `}</style>

      {/* Form Container */}
      <div className='sib-form p-0!' style={{ textAlign: 'center' }}>
        <div id='sib-form-container' className='sib-form-container'>
          {/* Form */}
          <div
            id='sib-container'
            className='sib-container--large sib-container--vertical'
            style={{
              textAlign: 'center',
              direction: 'ltr',
              width: '100%',
            }}
          >
            <form
              id='sib-form'
              method='POST'
              action='https://sibforms.com/serve/MUIFAMvp7vW3kMn8y8v0FQvSWuzRFSKeGmnymv65Sgwl6j8GfbYRPonAhkH-_H4QWnwwJXhx9GluHA10NDM8pzLjHmNejfmjOF_C8Q2-v58mc5oq2WPrXwsuJWSQU01Y3f4QpzxTKOaLGTDJFSQJvqJbkrXjxgsur0AkJUEmfLB0Rs9983EgGrVfsvZLwQ5Izqxws-VryR_KAZnz'
              data-type='subscription'
            >
              {/* Title */}
              <div style={{ padding: '8px 0' }}>
                <div
                  className='sib-form-block'
                  style={{
                    fontSize: '32px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    // color: "#ff914d",
                    color: 'black',
                    backgroundColor: 'transparent',
                  }}
                >
                  <p>{t('title')}</p>
                  <p>{t('freeLabel')}</p>
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: '8px 0' }}>
                <div
                  className='sib-form-block'
                  style={{
                    fontSize: '16px',
                    textAlign: 'left',
                    fontFamily: 'Inter, sans-serif',
                    color: '#3C4858',
                    backgroundColor: 'transparent',
                  }}
                >
                  <div className='sib-text-form-block'>
                    <p>{t('description')}</p>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div style={{ padding: '8px 0' }}>
                <div className='sib-input sib-form-block'>
                  <div className='form__entry entry_block'>
                    <div className='form__label-row'>
                      <label
                        className='entry__label'
                        style={{
                          fontWeight: 700,
                          textAlign: 'left',
                          fontSize: '16px',
                          fontFamily: 'Inter, sans-serif',
                          color: '#3c4858',
                        }}
                        htmlFor='EMAIL'
                        data-required='*'
                      >
                        {t('emailLabel')}
                      </label>
                      <div className='entry__field'>
                        <input
                          className='input'
                          type='text'
                          id='EMAIL'
                          name='EMAIL'
                          autoComplete='off'
                          placeholder='EMAIL'
                          data-required='true'
                          required
                        />
                      </div>
                    </div>
                    <label
                      className='entry__error entry__error--primary'
                      style={{
                        fontSize: '16px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#661d1d',
                        backgroundColor: '#ffeded',
                        borderRadius: '3px',
                        borderColor: '#ff4949',
                      }}
                    ></label>
                    <label
                      className='entry__specification'
                      style={{
                        fontSize: '12px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#8390A4',
                      }}
                    >
                      {t('emailHelpText')}
                    </label>
                  </div>
                </div>
              </div>

              {/* Zalo Input (Without Country Code Selector) */}
              <div style={{ padding: '8px 0' }}>
                <div className='sib-sms-field sib-form-block'>
                  <div className='form__entry entry_block'>
                    <div className='form__label-row'>
                      <label
                        className='entry__label'
                        style={{
                          fontWeight: 700,
                          textAlign: 'left',
                          fontSize: '16px',
                          fontFamily: 'Inter, sans-serif',
                          color: '#3c4858',
                        }}
                        htmlFor='SMS'
                        data-required='*'
                      >
                        {t('zaloLabel') || 'ZALO (lưu ý lời mời từ giáo viên)'}
                      </label>
                      <div className='sib-sms-input-wrapper' style={{ direction: 'ltr' }}>
                        {/* Hidden input for country code */}
                        <input
                          type='hidden'
                          name='SMS__COUNTRY_CODE'
                          value='+84'
                          data-required='true'
                        />
                        <div className='entry__field' style={{ width: '100%' }}>
                          <input
                            type='tel'
                            className='input'
                            id='SMS'
                            name='SMS'
                            autoComplete='off'
                            placeholder='SMS'
                            data-required='true'
                            required
                          />
                        </div>
                        <div className='sib-sms-tooltip'>
                          <div className='sib-sms-tooltip__box'>{t('zaloTooltip')}</div>
                          <span className='sib-sms-tooltip__icon'>?</span>
                        </div>
                      </div>
                    </div>
                    <label
                      className='entry__error entry__error--primary'
                      style={{
                        fontSize: '16px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#661d1d',
                        backgroundColor: '#ffeded',
                        borderRadius: '3px',
                        borderColor: '#ff4949',
                      }}
                    ></label>
                    <label
                      className='entry__error entry__error--secondary'
                      style={{
                        fontSize: '16px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#661d1d',
                        backgroundColor: '#ffeded',
                        borderRadius: '3px',
                        borderColor: '#ff4949',
                      }}
                    ></label>
                    <label
                      className='entry__specification'
                      style={{
                        fontSize: '12px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#8390A4',
                      }}
                    >
                      {t('zaloHelpText')}
                    </label>
                  </div>
                </div>
              </div>

              {/* Module Selection */}
              <div style={{ padding: '8px 0' }}>
                <div className='sib-radiobutton-group sib-form-block' data-required='true'>
                  <div className='form__entry entry_mcq'>
                    <div className='form__label-row'>
                      <label
                        className='entry__label'
                        style={{
                          fontWeight: 700,
                          textAlign: 'left',
                          fontSize: '16px',
                          fontFamily: 'Inter, sans-serif',
                          color: '#3c4858',
                        }}
                        htmlFor='MODULE'
                        data-required='*'
                      >
                        {t('moduleLabel')}
                      </label>
                      <div>
                        <div className='entry__choice'>
                          <label>
                            <input
                              type='radio'
                              name='MODULE'
                              className='input_replaced'
                              defaultValue='1'
                              required
                              defaultChecked
                            />
                            <span className='radio-button' style={{ marginLeft: '' }}></span>
                            <span
                              style={{
                                fontSize: '16px',
                                textAlign: 'left',
                                fontFamily: 'Inter, sans-serif',
                                color: '#3C4858',
                                backgroundColor: 'transparent',
                              }}
                            >
                              {t('moduleOptions.engineer')}
                            </span>
                          </label>
                        </div>
                        <div className='entry__choice'>
                          <label>
                            <input
                              type='radio'
                              name='MODULE'
                              className='input_replaced'
                              defaultValue='2'
                              required
                            />
                            <span className='radio-button' style={{ marginLeft: '' }}></span>
                            <span
                              style={{
                                fontSize: '16px',
                                textAlign: 'left',
                                fontFamily: 'Inter, sans-serif',
                                color: '#3C4858',
                                backgroundColor: 'transparent',
                              }}
                            >
                              {t('moduleOptions.economics')}
                            </span>
                          </label>
                        </div>
                        <div className='entry__choice'>
                          <label>
                            <input
                              type='radio'
                              name='MODULE'
                              className='input_replaced'
                              defaultValue='3'
                              required
                            />
                            <span className='radio-button' style={{ marginLeft: '' }}></span>
                            <span
                              style={{
                                fontSize: '16px',
                                textAlign: 'left',
                                fontFamily: 'Inter, sans-serif',
                                color: '#3C4858',
                                backgroundColor: 'transparent',
                              }}
                            >
                              {t('moduleOptions.naturalScience')}
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                    <label
                      className='entry__error entry__error--primary'
                      style={{
                        fontSize: '16px',
                        textAlign: 'left',
                        fontFamily: 'Inter, sans-serif',
                        color: '#661d1d',
                        backgroundColor: '#ffeded',
                        borderRadius: '3px',
                        borderColor: '#ff4949',
                      }}
                    ></label>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <div
                id='error-message'
                // className="mx-4"
                className='sib-form-message-panel'
                style={{
                  fontSize: '16px',
                  textAlign: 'left',
                  fontFamily: 'Inter, sans-serif',
                  color: '#661d1d',
                  backgroundColor: '#ffeded',
                  borderRadius: '3px',
                  borderColor: '#ff4949',
                  maxWidth: '100%',
                }}
              >
                <div className='sib-form-message-panel__text sib-form-message-panel__text--center'>
                  <svg viewBox='0 0 512 512' className='sib-icon sib-notification__icon'>
                    <path d='M256 40c118.621 0 216 96.075 216 216 0 119.291-96.61 216-216 216-119.244 0-216-96.562-216-216 0-119.203 96.602-216 216-216m0-32C119.043 8 8 119.083 8 256c0 136.997 111.043 248 248 248s248-111.003 248-248C504 119.083 392.957 8 256 8zm-11.49 120h22.979c6.823 0 12.274 5.682 11.99 12.5l-7 168c-.268 6.428-5.556 11.5-11.99 11.5h-8.979c-6.433 0-11.722-5.073-11.99-11.5l-7-168c-.283-6.818 5.167-12.5 11.99-12.5zM256 340c-15.464 0-28 12.536-28 28s12.536 28 28 28 28-12.536 28-28-12.536-28-28-28z' />
                  </svg>
                  <span className='sib-form-message-panel__inner-text'>{t('errorMessage')}</span>
                </div>
              </div>

              {/* Success Message */}
              <div
                id='success-message'
                // className="mx-4"
                className='sib-form-message-panel mx-4'
                style={{
                  fontSize: '16px',
                  textAlign: 'left',
                  fontFamily: 'Inter, sans-serif',
                  color: '#085229',
                  backgroundColor: '#e7faf0',
                  borderRadius: '3px',
                  borderColor: '#13ce66',
                  maxWidth: '540px',
                }}
              >
                <div className='sib-form-message-panel__text sib-form-message-panel__text--center'>
                  <svg viewBox='0 0 512 512' className='sib-icon sib-notification__icon'>
                    <path d='M256 8C119.033 8 8 119.033 8 256s111.033 248 248 248 248-111.033 248-248S392.967 8 256 8zm0 464c-118.664 0-216-96.055-216-216 0-118.663 96.055-216 216-216 118.664 0 216 96.055 216 216 0 118.663-96.055 216-216 216zm141.63-274.961L217.15 376.071c-4.705 4.667-12.303 4.637-16.97-.068l-85.878-86.572c-4.667-4.705-4.637-12.303.068-16.97l8.52-8.451c4.705-4.667 12.303-4.637 16.97.068l68.976 69.533 163.441-162.13c4.705-4.667 12.303-4.637 16.97.068l8.451 8.52c4.668 4.705 4.637 12.303-.068 16.97z' />
                  </svg>
                  <span className='sib-form-message-panel__inner-text'>{t('successMessage')}</span>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ padding: '8px 0' }}>
                <div className='sib-form-block' style={{ textAlign: 'left' }}>
                  <button
                    className='sib-form-block__button-with-loader bg-[#ff914d] text-white uppercase px-6 py-3 rounded-md hover:bg-orange-500 transition flex items-center justify-center cursor-pointer'
                    form='sib-form'
                    type='submit'
                  >
                    <svg
                      className='icon clickable__icon progress-indicator__icon sib-hide-loader-icon color-white'
                      viewBox='0 0 512 512'
                    >
                      <path d='M460.116 373.846l-20.823-12.022c-5.541-3.199-7.54-10.159-4.663-15.874 30.137-59.886 28.343-131.652-5.386-189.946-33.641-58.394-94.896-95.833-161.827-99.676C261.028 55.961 256 50.751 256 44.352V20.309c0-6.904 5.808-12.337 12.703-11.982 83.556 4.306 160.163 50.864 202.11 123.677 42.063 72.696 44.079 162.316 6.031 236.832-3.14 6.148-10.75 8.461-16.728 5.01z' />
                    </svg>
                    {t('submitButton')}
                  </button>
                </div>
              </div>

              {/* Hidden Inputs */}
              <input
                type='text'
                name='email_address_check'
                defaultValue=''
                className='input--hidden'
              />
              <input type='hidden' name='locale' defaultValue='en' />
            </form>
          </div>
        </div>
      </div>

      {/* Scripts (Recommended to be in footer) */}
      <Script id='brevo-form-script' strategy='afterInteractive'>
        {`
          window.REQUIRED_CODE_ERROR_MESSAGE = '${t('requiredCodeError')}';
          window.LOCALE = 'en';
          window.EMAIL_INVALID_MESSAGE = window.SMS_INVALID_MESSAGE = "${t('invalidMessage')}";
          window.REQUIRED_ERROR_MESSAGE = "${t('requiredError')}";
          window.GENERIC_INVALID_MESSAGE = "${t('invalidMessage')}";
          window.translation = {
            common: {
              selectedList: '{quantity} list selected',
              selectedLists: '{quantity} lists selected',
              selectedOption: '{quantity} selected',
              selectedOptions: '{quantity} selected',
            }
          };
          var AUTOHIDE = Boolean(0);
        `}
      </Script>
      {/* External script removed to prevent font loading errors */}
      <Script id='brevo-form-handler' strategy='afterInteractive'>
        {`
          // Custom form handling to replace external script
          document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('sib-form');
            if (form) {
              form.addEventListener('submit', function(e) {
                // Basic form validation and submission
                const email = form.querySelector('input[name="EMAIL"]');
                const sms = form.querySelector('input[name="SMS"]');
                const module = form.querySelector('input[name="MODULE"]:checked');
                
                if (!email.value || !sms.value || !module) {
                  e.preventDefault();
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('success-message').style.display = 'none';
                  return false;
                }
                
                // Hide error message on successful validation
                document.getElementById('error-message').style.display = 'none';
              });
            }
          });
        `}
      </Script>
    </>
  )
}
