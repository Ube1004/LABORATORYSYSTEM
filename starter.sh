@echo off

echo Starting LABSYSTEM...

if not exist venv (
    echo Creating virtual environment...
        python -m venv venv
        )

        call venv\Scripts\activate

        echo Installing requirements...
        pip install -r requirements.txt

        echo Starting Flask...
        python app.py

        pause