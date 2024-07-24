class AuthController < ApplicationController
    include ActionController::Cookies
    include ActionController::MimeResponds

    def authenticate
        report_id = cookies[:ReportID]
        authorization_token = cookies[:Authorization]

        if report_id.nil? || authorization_token.nil?
            render json: { error: 'Missing headers' }, status: :unprocessable_entity
            return
        end

        # Check if the report exists in the API
        report = Report.find_by(id: report_id)
        if report.nil?
            render json: { error: 'Report not found' }, status: :not_found
            return
        end

        # Check if the authorization token matches the report's token
        if authorization_token != report.token
            render json: { error: 'Invalid authorization token' }, status: :unauthorized
            return
        end

        # Return html 200
        render status: :ok
    end
  end