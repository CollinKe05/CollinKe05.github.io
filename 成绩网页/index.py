from flask import Flask

app = Flask(__name__)

@app.route('/')
def academic_transcript():
    # 替换为你指定的信息，保持教务系统风格
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <title>学生成绩单 - 教务管理系统</title>
        <style>
            /* 全局样式：模拟教务系统的基础风格 */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: "微软雅黑", "宋体", Arial, sans-serif;
                font-size: 14px;
            }
            body {
                padding: 30px;
                background-color: #f5f5f5;
            }
            /* 成绩单容器：模拟纸质成绩单的白色背景和边框 */
            .transcript-container {
                width: 800px;
                margin: 0 auto;
                background-color: white;
                padding: 20px;
                border: 1px solid #ccc;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            /* 学校/院系信息样式 */
            .school-info {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }
            .school-name {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .dept-name {
                font-size: 16px;
                color: #666;
            }
            /* 学生基本信息样式 */
            .student-info {
                margin-bottom: 20px;
                padding: 10px;
                background-color: #f9f9f9;
                border: 1px solid #eee;
            }
            .student-info p {
                margin: 5px 0;
                line-height: 1.5;
            }
            .student-info span {
                font-weight: bold;
                color: #333;
            }
            /* 成绩表格样式：教务系统核心样式 */
            .score-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .score-table th, .score-table td {
                border: 1px solid #ccc;
                padding: 10px;
                text-align: center;
            }
            .score-table th {
                background-color: #e9e9e9;
                font-weight: bold;
            }
            .score-table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            /* 满分课程高亮 */
            .full-score {
                color: #008000; /* 绿色标注满分 */
                font-weight: bold;
            }
            /* 最终成绩样式：红色突出显示 */
            .final-score {
                padding: 15px;
                border: 1px solid #ffcccc;
                background-color: #fff5f5;
                margin-top: 20px;
            }
            .final-score h2 {
                font-size: 18px;
                color: #ff0000; /* 红色文字 */
                font-weight: bold;
            }
            /* 页脚信息 */
            .footer {
                margin-top: 30px;
                text-align: right;
                color: #999;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="transcript-container">
            <!-- 学校/院系信息（更新为XX大学） -->
            <div class="school-info">
                <div class="school-name">XX大学</div>
                <div class="dept-name">工科院系 - 教务管理系统</div>
                <div style="margin-top: 8px; font-size: 16px; font-weight: bold;">学生学期成绩单</div>
            </div>

            <!-- 学生基本信息（更新为小明、某工科） -->
            <div class="student-info">
                <p><span>姓名：</span>小明 &nbsp;&nbsp;&nbsp;&nbsp; <span>学号：</span>2023002001 &nbsp;&nbsp;&nbsp;&nbsp; <span>专业：</span>某工科</p >
                <p><span>年级：</span>2023级 &nbsp;&nbsp;&nbsp;&nbsp; <span>班级：</span>工科2302班 &nbsp;&nbsp;&nbsp;&nbsp; <span>学期：</span>2024-2025学年第一学期</p >
            </div>

            <!-- 课程成绩明细表格（替换为指定课程，scratch编程设为100分） -->
            <table class="score-table">
                <thead>
                    <tr>
                        <th>课程编号</th>
                        <th>课程名称</th>
                        <th>学分</th>
                        <th>平时成绩</th>
                        <th>期末成绩</th>
                        <th>综合成绩</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>EK202401</td>
                        <td>泛函分析</td>
                        <td>3.0</td>
                        <td>50</td>
                        <td>45</td>
                        <td>47</td>
                    </tr>
                    <tr>
                        <td>EK202402</td>
                        <td>群论</td>
                        <td>3.0</td>
                        <td>55</td>
                        <td>48</td>
                        <td>51</td>
                    </tr>
                    <tr>
                        <td>EK202403</td>
                        <td>量子力学</td>
                        <td>4.0</td>
                        <td>48</td>
                        <td>42</td>
                        <td>45</td>
                    </tr>
                    <tr>
                        <td>EK202404</td>
                        <td>数字电路</td>
                        <td>3.5</td>
                        <td>52</td>
                        <td>46</td>
                        <td>49</td>
                    </tr>
                    <tr>
                        <td>EK202405</td>
                        <td>模拟电路</td>
                        <td>3.5</td>
                        <td>50</td>
                        <td>44</td>
                        <td>47</td>
                    </tr>
                    <tr>
                        <td>EK202406</td>
                        <td>scratch编程</td>
                        <td>2.0</td>
                        <td>100</td>
                        <td>100</td>
                        <td class="full-score">100</td>
                    </tr>
                </tbody>
            </table>

            <!-- 最终成绩汇总（红色突出显示59分） -->
            <div class="final-score">
                <h2>最终综合评定成绩：59</h2>
            </div>

            <!-- 页脚 -->
            <div class="footer">
                打印时间：2025-12-26 &nbsp;&nbsp; 教务系统自动生成，无盖章无效
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

if __name__ == '__main__':
    app.run(debug=True)